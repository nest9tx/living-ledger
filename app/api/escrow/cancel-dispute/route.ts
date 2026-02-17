import supabase from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const body = await req.json();
    const escrowId = Number(body?.escrowId);

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    // Get escrow details
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, payer_id, provider_id, status, dispute_status, credits_held, offer_id, request_id, dispute_reason")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    // Only the person who reported the dispute can cancel it
    const isReporter = escrow.payer_id === userData.user.id || escrow.provider_id === userData.user.id;
    if (!isReporter) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can only cancel disputes that are still open
    if (escrow.status !== "disputed" || escrow.dispute_status !== "open") {
      return Response.json({ error: "Dispute cannot be cancelled" }, { status: 400 });
    }

    // Revert escrow back to held status
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "held",
        dispute_status: null,
        dispute_reason: null,
        dispute_reported_at: null,
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Cancel dispute error:", updateError);
      return Response.json({ error: "Failed to cancel dispute" }, { status: 500 });
    }

    // Send notification emails to both parties
    const reporterRole = escrow.payer_id === userData.user.id ? "buyer" : "provider";
    const otherUserId = reporterRole === "buyer" ? escrow.provider_id : escrow.payer_id;

    const { data: reporterAuth } = await supabaseAdmin.auth.admin.getUserById(userData.user.id);
    const { data: otherAuth } = await supabaseAdmin.auth.admin.getUserById(otherUserId);
    
    const reporterEmail = reporterAuth?.user?.email;
    const otherEmail = otherAuth?.user?.email;
    
    const listingTitle = escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`;
    const listingUrl = escrow.offer_id 
      ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/listing/offer/${escrow.offer_id}`
      : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/listing/request/${escrow.request_id}`;

    // Email to other party (dispute cancelled notification)
    if (otherEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [otherEmail],
          subject: `✅ Dispute Cancelled - ${listingTitle}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Dispute Cancelled</h2>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p>Good news! The dispute for <strong>${listingTitle}</strong> has been withdrawn by the ${reporterRole}.</p>
              </div>
              
              <div style="margin: 16px 0;">
                <p><strong>Credits Held:</strong> ${escrow.credits_held}</p>
                <p><strong>Status:</strong> Order restored to normal escrow process</p>
              </div>
              
              <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0; font-weight: 600; color: #1976d2;">What happens next:</p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                  <li>The order continues with normal completion process</li>
                  <li>Both parties can confirm delivery/completion as usual</li>
                  <li>Credits will be released when both parties agree work is done</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${listingUrl}" 
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View Listing
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated message from Living Ledger. Please do not reply to this email.
                Contact support@livingledger.org if you need assistance.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Failed to send dispute cancellation email:", emailError);
      }
    }

    // Email to reporter (confirmation)
    if (reporterEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [reporterEmail],
          subject: `✅ Dispute Cancelled - ${listingTitle}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Dispute Successfully Cancelled</h2>
              
              <p>Your dispute for <strong>${listingTitle}</strong> has been withdrawn.</p>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0 0 8px 0; color: #065f46;">Order Status Restored:</h3>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                  <li>Escrow returned to normal completion process</li>
                  <li>Both parties have been notified</li>
                  <li>You can continue working toward completion</li>
                  <li>Credits will be released when both parties confirm delivery</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${listingUrl}" 
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  View Listing
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated message from Living Ledger. Please do not reply to this email.
                Contact support@livingledger.org if you need assistance.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Failed to send dispute cancellation confirmation:", emailError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Cancel dispute error:", error);
    return Response.json({ error: "Failed to cancel dispute" }, { status: 500 });
  }
}