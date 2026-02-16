import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

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

    const { amount_credits } = await req.json();

    if (!amount_credits || amount_credits < 20 || !Number.isInteger(amount_credits)) {
      return Response.json({ error: "Minimum cashout is $20" }, { status: 400 });
    }

    // Check earned credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("earned_credits")
      .eq("id", userData.user.id)
      .single();

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const earned = profile.earned_credits || 0;
    if (earned < amount_credits) {
      return Response.json(
        { error: `Insufficient earned credits. You have $${earned}` },
        { status: 400 }
      );
    }

    // Create cashout request
    const { data: cashout, error: cashoutError } = await supabaseAdmin
      .from("cashout_requests")
      .insert({
        user_id: userData.user.id,
        amount_credits,
        status: "pending",
      })
      .select()
      .single();

    if (cashoutError || !cashout) {
      console.error("Cashout creation error:", cashoutError);
      return Response.json({ error: "Failed to create cashout request" }, { status: 500 });
    }

    // Deduct from earned credits (hold in limbo pending approval)
    const { error: deductError } = await supabaseAdmin
      .from("profiles")
      .update({ earned_credits: earned - amount_credits })
      .eq("id", userData.user.id);

    if (deductError) {
      console.error("Deduction error:", deductError);
      return Response.json({ error: "Failed to process cashout" }, { status: 500 });
    }

    // Record transaction
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userData.user.id,
        amount: -amount_credits,
        description: `Cashout request pending admin approval ($${amount_credits})`,
        transaction_type: "cashout_hold",
        credit_source: "earned",
        can_cashout: false,
      });

    if (txError) {
      console.error("Transaction error:", txError);
    }

    return Response.json({
      success: true,
      cashoutId: cashout.id,
      amountRequested: amount_credits,
      message: "Cashout request submitted for admin review",
    });
  } catch (error) {
    console.error("Cashout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create cashout request" },
      { status: 500 }
    );
  }
}
