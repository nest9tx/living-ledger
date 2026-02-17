import supabaseAdmin from "@/lib/supabase-admin";
import supabase from "@/lib/supabase";
// import Stripe from "stripe"; // Reserved for future automated payouts
import { Resend } from "resend";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2026-01-28.clover",
// });

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

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
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
        profiles!inner(
          username,
          email,
          bank_account_name,
          bank_account_last4,
          bank_routing_number,
          bank_account_type
        )
      `)
      .eq("id", cashout_id)
      .single();

    if (!cashout) {
      return Response.json({ error: "Cashout request not found" }, { status: 404 });
    }

    if (cashout.status !== "pending") {
      return Response.json(
        { error: `Cannot approve cashout with status: ${cashout.status}` },
        { status: 400 }
      );
    }

    // Update cashout request to approved
    const { error: updateError } = await supabaseAdmin
      .from("cashout_requests")
      .update({
        status: "approved",
        admin_id: userData.user.id,
        admin_note: admin_note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", cashout_id);

    if (updateError) {
      console.error("Cashout update error:", updateError);
      return Response.json({ error: "Failed to approve cashout" }, { status: 500 });
    }

    // Record transaction for approved cashout
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: cashout.user_id,
        amount: -cashout.amount_credits,
        description: `Cashout approved by admin ($${cashout.amount_credits})`,
        transaction_type: "cashout_approved",
        credit_source: "earned",
        can_cashout: false,
      });

    if (txError) {
      console.error("Transaction error:", txError);
    }

    // Log manual payout info for admin
    const profile = cashout.profiles;
    console.log("\n=== MANUAL PAYOUT REQUIRED ===");
    console.log(`Amount: $${cashout.amount_usd}`);
    console.log(`User: ${profile.username} (${profile.email})`);
    console.log(`Bank: ${profile.bank_account_name} (****${profile.bank_account_last4})`);
    console.log(`Routing: ${profile.bank_routing_number}`);
    console.log(`Type: ${profile.bank_account_type}`);
    console.log("==============================\n");

    // Send email notification
    try {
      await resend.emails.send({
        from: "Living Ledger <support@livingledger.org>",
        to: cashout.profiles.email,
        subject: "✓ Cashout Approved - Payment Processing",
        html: `
          <h2>Your cashout has been approved!</h2>
          <p>Hi ${cashout.profiles.username},</p>
          <p>Great news! Your cashout request has been approved by our admin team.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Amount:</strong> $${cashout.amount_usd} USD</p>
            <p style="margin: 8px 0 0 0;"><strong>Bank Account:</strong> ****${cashout.profiles.bank_account_last4}</p>
          </div>
          
          <p>Your payment will arrive in your bank account within <strong>2-5 business days</strong>.</p>
          
          ${admin_note ? `<p><strong>Admin Note:</strong> ${admin_note}</p>` : ""}
          
          <p>Thank you for being part of Living Ledger!</p>
          
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #6b7280;">
            Questions? Reply to this email or visit <a href="${process.env.NEXT_PUBLIC_APP_URL}">livingledger.org</a>
          </p>
        `,
      });
    } catch (emailError: unknown) {
      console.error("Email notification error:", emailError);
      // Don't fail the approval if email fails
    }

    return Response.json({
      success: true,
      cashoutId: cashout_id,
      status: "approved",
      message: "Cashout approved. User notified via email. Payment will process within 2-5 business days.",
    });
  } catch (error) {
    console.error("Admin approve cashout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to approve cashout" },
      { status: 500 }
    );
  }
}
