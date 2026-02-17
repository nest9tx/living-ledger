import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const escrowId = Number(body?.escrowId);
    const adminNote = body?.adminNote || null;

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select(`
        id, payer_id, provider_id, credits_held, status, offer_id, request_id,
        payer:profiles!credit_escrow_payer_id_fkey(username),
        provider:profiles!credit_escrow_provider_id_fkey(username)
      `)
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.status === "released" || escrow.status === "refunded") {
      return Response.json({ error: "Escrow already finalized" }, { status: 400 });
    }

    const credits = escrow.credits_held || 0;
    const listingLabel = escrow.offer_id
      ? `Offer #${escrow.offer_id}`
      : escrow.request_id
        ? `Request #${escrow.request_id}`
        : "Listing";
    if (credits < 1) {
      return Response.json({ error: "Invalid escrow amount" }, { status: 400 });
    }

    const { error: refundError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.payer_id,
        amount: credits,
        description: `Escrow refund for ${listingLabel} (${credits} credits)`,
        transaction_type: "refund",
        credit_source: "refund",
        related_offer_id: escrow.offer_id,
        related_request_id: escrow.request_id,
        can_cashout: false,
      });

    if (refundError) {
      console.error("Admin refund error:", refundError);
      return Response.json({ error: "Failed to refund" }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "refunded",
        dispute_status: "resolved",
        resolved_at: new Date().toISOString(),
        admin_note: adminNote,
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Admin escrow update error:", updateError);
      return Response.json({ error: "Failed to update escrow" }, { status: 500 });
    }

    // Send resolution emails to both parties
    const { data: providerAuth } = await supabaseAdmin.auth.admin.getUserById(escrow.provider_id);
    const { data: payerAuth } = await supabaseAdmin.auth.admin.getUserById(escrow.payer_id);
    
    const providerEmail = providerAuth?.user?.email;
    const payerEmail = payerAuth?.user?.email;
    const listingTitle = escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`;

    // Email to payer (winner - getting refund)
    if (payerEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [payerEmail],
          subject: `✅ Dispute Resolved - Refund Issued for Order #${escrowId}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Dispute Resolved - Refund Issued</h2>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Good news!</strong> The dispute for Order #${escrowId} has been resolved in your favor.</p>
              </div>
              
              <div style="margin: 16px 0;">
                <p><strong>Order:</strong> ${listingTitle}</p>
                <p><strong>Credits Refunded:</strong> ${escrow.credits_held}</p>
                ${adminNote ? `<p><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
              </div>
              
              <div style="background: #fffbeb; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>💰 Your credits have been refunded to your account!</strong></p>
                <p>You can use these credits for new orders or request a cashout from your dashboard.</p>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/dashboard" 
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View Dashboard
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated message from Living Ledger. Please do not reply to this email.
                Contact support@livingledger.org if you need assistance.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send refund email to payer:", emailError);
      }
    }

    // Email to provider (notification)
    if (providerEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [providerEmail],
          subject: `📋 Dispute Resolved - Order #${escrowId}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #374151;">Dispute Resolution Complete</h2>
              
              <p>The dispute for <strong>Order #${escrowId}</strong> (${listingTitle}) has been resolved by our admin team.</p>
              
              <div style="background: #f3f4f6; border: 1px solid #d1d5db; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Resolution:</strong> Credits have been refunded to the buyer</p>
                <p><strong>Order Status:</strong> Refunded</p>
                ${adminNote ? `<p><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/orders/${escrowId}" 
                   style="background: #374151; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View Order Details
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated message from Living Ledger. Please do not reply to this email.
                Contact support@livingledger.org if you need assistance.
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send refund email to provider:", emailError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin refund error:", error);
    return Response.json({ error: "Failed to refund escrow" }, { status: 500 });
  }
}
