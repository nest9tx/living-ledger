import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const escrowId = Number(body?.escrowId);

    if (!Number.isFinite(escrowId)) {
      return NextResponse.json({ error: "Invalid escrow ID" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("*")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
    }

    // Only provider (seller) can confirm completion
    if (escrow.provider_id !== user.id) {
      return NextResponse.json(
        { error: "Only the service provider can confirm completion" },
        { status: 403 }
      );
    }

    // Must be in "held" or "delivered" status to confirm completion
    if (escrow.status !== "held" && escrow.status !== "delivered") {
      return NextResponse.json(
        { error: "Cannot confirm completion for this order" },
        { status: 400 }
      );
    }

    if (escrow.provider_confirmed_at) {
      return NextResponse.json(
        { error: "You have already confirmed completion" },
        { status: 400 }
      );
    }

    const now = new Date();
    // If buyer already confirmed, go straight to "confirmed"; otherwise move to "delivered"
    const newStatus = escrow.payer_confirmed_at ? "confirmed" : "delivered";

    // Update escrow: mark provider as confirmed
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: newStatus,
        provider_confirmed_at: now.toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Failed to confirm completion:", updateError);
      return NextResponse.json({ error: "Failed to confirm completion" }, { status: 500 });
    }

    // Log transaction
    await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.provider_id,
        type: "escrow_confirmed",
        credits: 0,
        description: `Confirmed completion for ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`}${newStatus === "confirmed" ? " - Both parties confirmed, funds ready to release" : ""}`,
        related_escrow_id: escrowId,
      });

    // Email the buyer that their order has been delivered
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.livingledger.org";
      const orderUrl = `${siteUrl}/orders/${escrowId}`;

      const [{ data: buyerAuth }, { data: buyerProfile }, { data: providerProfile }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(escrow.payer_id),
        supabaseAdmin.from("profiles").select("username").eq("id", escrow.payer_id).single(),
        supabaseAdmin.from("profiles").select("username").eq("id", escrow.provider_id).single(),
      ]);

      const buyerEmail = buyerAuth?.user?.email;
      const buyerUsername = buyerProfile?.username || "there";
      const providerUsername = providerProfile?.username || "Your provider";
      const listingRef = escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`;

      if (buyerEmail) {
        await resend.emails.send({
          from: "Living Ledger <support@livingledger.org>",
          to: [buyerEmail],
          subject: `✅ Your order has been delivered — ${listingRef}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
              <div style="padding: 32px 0 16px;">
                <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 8px;">Your order has been delivered! 📦</h2>
                <p style="color: #555; margin: 0;">Hey ${buyerUsername}, <strong>${providerUsername}</strong> has marked your order as complete and your deliverable is ready.</p>
              </div>
              <div style="background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 16px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 6px 0; color: #555; font-size: 14px;">Order</td><td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500;">#${escrowId} &mdash; ${listingRef}</td></tr>
                  <tr><td style="padding: 6px 0; color: #555; font-size: 14px;">Provider</td><td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500;">${providerUsername}</td></tr>
                  <tr><td style="padding: 6px 0; color: #555; font-size: 14px;">Credits</td><td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500; color: #16a34a;">${escrow.credits_held} credits</td></tr>
                </table>
              </div>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">Please log in to review and download your deliverable. Once you&rsquo;re satisfied, confirm delivery to start the 7-day release window.</p>
              <div style="margin: 24px 0;">
                <a href="${orderUrl}" style="background: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">View &amp; Confirm Order</a>
              </div>
              <p style="font-size: 12px; color: #999;">If you have any issues with the delivery, you can open a dispute directly from the order page.</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send delivery notification email:", emailErr);
      // Don't fail the confirmation if email fails
    }

    return NextResponse.json({
      success: true,
      escrowId,
      status: newStatus,
      bothConfirmed: newStatus === "confirmed",
      message:
        newStatus === "confirmed"
          ? "Both parties confirmed! You can now release funds immediately or wait for auto-release."
          : "Completion confirmed. Awaiting buyer confirmation for instant release.",
    });
  } catch (error: unknown) {
    console.error("Confirm completion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to confirm completion" },
      { status: 500 }
    );
  }
}
