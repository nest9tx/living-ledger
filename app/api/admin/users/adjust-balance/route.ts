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
    const body = await req.json();
    const { userId, amount, reason } = body;
    const creditType = body.creditType || "balance"; // balance, earned, or purchased

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


    // Get current balances
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance, earned_credits, purchased_credits")
      .eq("id", userId)
      .single();

    if (!currentProfile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const currentTotalBalance = currentProfile.credits_balance || 0;
    const currentEarned = currentProfile.earned_credits || 0;
    const currentPurchased = currentProfile.purchased_credits || 0;

    // Calculate new balances based on credit type
    let updateData: Record<string, number> = {};
    let targetBalance = 0;

    if (creditType === "earned") {
      // Adjust earned credits and total balance
      const newEarned = currentEarned + amountInt;
      const newTotal = currentTotalBalance + amountInt;
      
      if (newEarned < 0 || newTotal < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current earned: ${currentEarned}, total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      
      updateData = {
        earned_credits: newEarned,
        credits_balance: newTotal
      };
      targetBalance = newEarned;
    } else if (creditType === "purchased") {
      // Adjust purchased credits and total balance
      const newPurchased = currentPurchased + amountInt;
      const newTotal = currentTotalBalance + amountInt;
      
      if (newPurchased < 0 || newTotal < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current purchased: ${currentPurchased}, total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      
      updateData = {
        purchased_credits: newPurchased,
        credits_balance: newTotal
      };
      targetBalance = newPurchased;
    } else {
      // Adjust only total balance (legacy/general adjustment)
      const newTotal = currentTotalBalance + amountInt;
      
      if (newTotal < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      
      updateData = { credits_balance: newTotal };
      targetBalance = newTotal;
    }

    const { error: finalUpdateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
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
      description: `Admin adjustment (${creditType}): ${reason}`,
      transaction_type: "admin_adjustment",
      credit_source: creditType === "earned" ? "earned" : "purchased",
      can_cashout: creditType === "earned",
    });

    return NextResponse.json({
      success: true,
      newBalance: targetBalance,
      newTotal: updateData.credits_balance || currentTotalBalance,
      creditType,
      message: `${creditType === 'earned' ? 'Earned credits' : creditType === 'purchased' ? 'Purchased credits' : 'Balance'} adjusted by ${amountInt > 0 ? '+' : ''}${amountInt} credits`,
    });
  } catch (error) {
    console.error("Admin adjust balance error:", error);
    return NextResponse.json(
      { error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
