import supabaseAdmin from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (!admin?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { cashout_id, admin_note } = await req.json();

    if (!cashout_id) {
      return Response.json({ error: "Cashout ID required" }, { status: 400 });
    }

    // Get cashout request with user profile
    const { data: cashout } = await supabaseAdmin
      .from("cashout_requests")
      .select(`
        *,
        profiles!inner(username, email)
      `)
      .eq("id", cashout_id)
      .single();

    if (!cashout) {
      return Response.json({ error: "Cashout request not found" }, { status: 404 });
    }

    if (cashout.status !== "pending") {
      return Response.json(
        { error: `Cannot reject cashout with status: ${cashout.status}` },
        { status: 400 }
      );
    }

    // Update cashout request to rejected
    const { error: updateError } = await supabaseAdmin
      .from("cashout_requests")
      .update({
        status: "rejected",
        admin_id: userData.user.id,
        admin_note: admin_note || "Rejected by admin",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", cashout_id);

    if (updateError) {
      console.error("Cashout update error:", updateError);
      return Response.json({ error: "Failed to reject cashout" }, { status: 500 });
    }

    // Return credits to user (reverse the hold)
    const { error: creditError } = await supabaseAdmin
      .from("profiles")
      .update({
        earned_credits: (await supabaseAdmin.from("profiles").select("earned_credits").eq("id", cashout.user_id).single()).data?.earned_credits + cashout.amount_credits,
      })
      .eq("id", cashout.user_id);

    if (creditError) {
      console.error("Credit return error:", creditError);
    }

    // Record transaction for rejected cashout
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: cashout.user_id,
        amount: cashout.amount_credits,
        description: `Cashout #${cashout_id} rejected by admin (credits returned)${admin_note ? `: ${admin_note}` : ""}`,
        transaction_type: "cashout_rejected",
        credit_source: "earned",
        can_cashout: true,
      });

    if (txError) {
      console.error("Transaction error:", txError);
    }

    // Send email notification
    try {
      await resend.emails.send({
        from: "Living Ledger <support@livingledger.org>",
        to: cashout.profiles.email,
        subject: "Cashout Request Update",
        html: `
          <h2>Cashout Request Status Update</h2>
          <p>Hi ${cashout.profiles.username},</p>
          <p>We're writing to inform you about your recent cashout request.</p>
          
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="margin: 0; color: #dc2626;"><strong>Status:</strong> Request Declined</p>
            <p style="margin: 8px 0 0 0;"><strong>Amount:</strong> $${cashout.amount_usd} USD</p>
          </div>
          
          <p><strong>Reason:</strong> ${admin_note || "Please contact support for more information."}</p>
          
          <p>Your <strong>$${cashout.amount_credits} credits</strong> have been returned to your earned balance and are available for use or future cashout requests.</p>
          
          <p>If you have questions about this decision, please reply to this email or contact our support team.</p>
          
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #6b7280;">
            Questions? Reply to this email or visit <a href="${process.env.NEXT_PUBLIC_APP_URL}">livingledger.org</a>
          </p>
        `,
      });
    } catch (emailError: unknown) {
      console.error("Email notification error:", emailError);
      // Don't fail the rejection if email fails
    }

    return Response.json({
      success: true,
      cashoutId: cashout_id,
      status: "rejected",
      message: "Cashout rejected. User notified via email. Credits returned to user.",
    });
  } catch (error) {
    console.error("Admin reject cashout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to reject cashout" },
      { status: 500 }
    );
  }
}
