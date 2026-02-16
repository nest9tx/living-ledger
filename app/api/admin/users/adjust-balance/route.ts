import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/users/adjust-balance
 * 
 * Allows admin to adjust a user's credits balance (for promotions or error correction).
 * Requires admin authentication.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Verify auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check admin status
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access denied" }, { status: 403 });
    }

    // Parse request body
    const { userId, amount, reason, creditType } = await req.json();

    if (!userId || !amount || !reason) {
      return NextResponse.json(
        { error: "userId, amount, and reason are required" },
        { status: 400 }
      );
    }

    const amountInt = parseInt(amount);
    if (isNaN(amountInt)) {
      return NextResponse.json(
        { error: "Amount must be a number" },
        { status: 400 }
      );
    }

    // Determine which balance to update
    const balanceField: "credits_balance" | "earned_credits" | "purchased_credits" = 
      creditType === "earned" ? "earned_credits" : 
      creditType === "purchased" ? "purchased_credits" :
      "credits_balance";

    // Get current balance
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select(`${balanceField}`)
      .eq("id", userId)
      .single();

    if (!currentProfile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentBalance = ((currentProfile as Record<string, number>)[balanceField]) || 0;
    const newBalance = currentBalance + amountInt;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: `Cannot reduce balance below 0. Current balance: ${currentBalance}` },
        { status: 400 }
      );
    }

    const { error: finalUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ [balanceField]: newBalance })
      .eq("id", userId);

    if (finalUpdateError) {
      console.error("Balance update error:", finalUpdateError);
      return NextResponse.json(
        { error: "Failed to update balance" },
        { status: 500 }
      );
    }

    // Record transaction for audit trail
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: amountInt,
      description: `Admin adjustment: ${reason}`,
      transaction_type: "admin_adjustment",
      credit_source: creditType === "earned" ? "earned" : "purchased",
      can_cashout: creditType === "earned",
    });

    return NextResponse.json({
      success: true,
      newBalance,
      message: `Balance adjusted by ${amountInt > 0 ? '+' : ''}${amountInt} credits`,
    });
  } catch (error) {
    console.error("Admin adjust balance error:", error);
    return NextResponse.json(
      { error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
