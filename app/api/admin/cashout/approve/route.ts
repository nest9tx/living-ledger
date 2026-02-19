import supabaseAdmin from "@/lib/supabase-admin";
import Stripe from "stripe";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

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
        profiles!inner(
          username,
          email,
          stripe_account_id,
          stripe_account_status
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
        description: `Cashout #${cashout_id} approved by admin ($${cashout.amount_credits})`,
        transaction_type: "cashout_approved",
        credit_source: "earned",
        can_cashout: false,
      });

    if (txError) {
      console.error("Transaction error:", txError);
    }

    // Process automated Stripe transfer
    let transferSuccessful = false;
    try {
      const profile = cashout.profiles;
      
      if (!profile.stripe_account_id) {
        throw new Error("User has not connected a Stripe account");
      }

      if (profile.stripe_account_status !== "active") {
        throw new Error("User's Stripe account is not fully verified");
      }

      // Create transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(cashout.amount_usd * 100), // Convert to cents
        currency: "usd",
        destination: profile.stripe_account_id,
        description: `Living Ledger Cashout #${cashout_id} for ${cashout.amount_credits} credits`,
        metadata: {
          cashout_id: cashout_id.toString(),
          user_id: cashout.user_id,
          username: profile.username,
        },
      });

      console.log(`✓ Stripe transfer created: ${transfer.id} for $${cashout.amount_usd}`);
      transferSuccessful = true;

      // Optionally update cashout with transfer ID
      await supabaseAdmin
        .from("cashout_requests")
        .update({ 
          paid_at: new Date().toISOString(),
          status: "paid",
        })
        .eq("id", cashout_id);

    } catch (stripeError: unknown) {
      console.error("Stripe transfer error:", stripeError);
      console.log("\n⚠️ FALLBACK: Manual payout may be required");
      console.log(`Cashout ID: ${cashout_id}`);
      console.log(`Amount: $${cashout.amount_usd}`);
      console.log(`User: ${cashout.profiles.username} (${cashout.profiles.email})`);
      // Don't fail the approval - admin can handle manually
    }

    // Send email notification
    try {
      await resend.emails.send({
        from: "Living Ledger <support@livingledger.org>",
        to: cashout.profiles.email,
        subject: "✓ Cashout Approved - Payment Processing",
        html: `
          <h2>Your cashout has been approved!</h2>
          <p>Hi ${cashout.profiles.username},</p>
          <p>Great news! Your cashout request has been approved${transferSuccessful ? " and payment has been sent" : ""}.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Amount:</strong> $${cashout.amount_usd} USD</p>
            ${transferSuccessful ? `<p style="margin: 8px 0 0 0;"><strong>Status:</strong> Payment sent to your Stripe account</p>` : ""}
          </div>
          
          <p>Your payment will arrive in your ${transferSuccessful ? "Stripe account (then to your bank)" : "bank account"} within <strong>2-5 business days</strong>.</p>
          
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
      status: transferSuccessful ? "paid" : "approved",
      transferSuccessful,
      message: transferSuccessful 
        ? "Cashout approved and payment transferred to user's Stripe account."
        : "Cashout approved. User notified via email. Check console for manual payout info if transfer failed.",
    });
  } catch (error) {
    console.error("Admin approve cashout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to approve cashout" },
      { status: 500 }
    );
  }
}
