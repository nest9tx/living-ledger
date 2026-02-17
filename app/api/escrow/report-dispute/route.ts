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
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    // Get escrow details
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("id, payer_id, provider_id, status, credits_held, offer_id, request_id")
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    const isReporter = escrow.payer_id === userData.user.id || escrow.provider_id === userData.user.id;
    if (!isReporter) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (escrow.status === "released" || escrow.status === "refunded") {
      return Response.json({ error: "Escrow already finalized" }, { status: 400 });
    }

    const reporterRole = escrow.payer_id === userData.user.id ? "buyer" : "provider";
    const otherUserId = reporterRole === "buyer" ? escrow.provider_id : escrow.payer_id;

    // Get usernames for email notifications
    const { data: payerProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", escrow.payer_id)
      .single();

    const { data: providerProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", escrow.provider_id)
      .single();

    const reporterUsername = reporterRole === "buyer" ? payerProfile?.username : providerProfile?.username;

    // Update escrow status
    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update({
        status: "disputed",
        dispute_status: "open",
        dispute_reason: reason || null,
        dispute_reported_at: new Date().toISOString(),
      })
      .eq("id", escrowId);

    if (updateError) {
      console.error("Dispute update error:", updateError);
      return Response.json({ error: "Failed to open dispute" }, { status: 500 });
    }

    // Get email addresses for both parties
    const { data: reporterAuth } = await supabaseAdmin.auth.admin.getUserById(userData.user.id);
    const { data: otherAuth } = await supabaseAdmin.auth.admin.getUserById(otherUserId);
    
    const reporterEmail = reporterAuth?.user?.email;
    const otherEmail = otherAuth?.user?.email;
    
    const listingTitle = escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`;
    
    // Send email to the other party (dispute notification)
    if (otherEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [otherEmail],
          subject: `🚨 Dispute Filed - Order #${escrowId} Requires Your Attention`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Dispute Filed on Your Order</h2>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>Order #${escrowId}</strong> has a dispute that requires your immediate attention.</p>
              </div>
              
              <div style="margin: 16px 0;">
                <p><strong>Listing:</strong> ${listingTitle}</p>
                <p><strong>Credits Held:</strong> ${escrow.credits_held}</p>
                <p><strong>Reported by:</strong> ${reporterRole} (${reporterUsername || 'User'})</p>
                ${reason ? `<p><strong>Issue Description:</strong> ${reason}</p>` : ''}
              </div>
              
              <div style="background: #fffbeb; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0 0 8px 0; color: #92400e;">What happens next:</h3>
                <ol style="margin: 8px 0 0 0; padding-left: 20px;">
                  <li>A Living Ledger admin will review this dispute within 48 hours</li>
                  <li>You'll receive an email if we need additional information</li>
                  <li>You'll have 48 hours to respond to any admin requests</li>
                  <li>The admin will make a final decision based on all evidence</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/orders/${escrowId}" 
                   style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
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
        console.error("Failed to send dispute notification email:", emailError);
        // Don't fail the dispute creation if email fails
      }
    }

    // Send confirmation email to reporter
    if (reporterEmail) {
      try {
        await resend.emails.send({
          from: "Living Ledger Support <support@livingledger.org>",
          to: [reporterEmail],
          subject: `✓ Dispute Submitted - Order #${escrowId}`,
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Dispute Successfully Submitted</h2>
              
              <p>Your dispute for <strong>Order #${escrowId}</strong> (${listingTitle}) has been submitted successfully.</p>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0 0 8px 0; color: #065f46;">Next Steps:</h3>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                  <li>A Living Ledger admin will review your case within 48 hours</li>
                  <li>The other party has been notified via email</li>
                  <li>You may receive follow-up questions from our team</li>
                  <li>Please respond to any admin requests within 48 hours</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://livingledger.org'}/orders/${escrowId}" 
                   style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                  Track Dispute Status
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
        console.error("Failed to send dispute confirmation email:", emailError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Report dispute error:", error);
    return Response.json({ error: "Failed to open dispute" }, { status: 500 });
  }
}
