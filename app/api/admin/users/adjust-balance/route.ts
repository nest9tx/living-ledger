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

    if (!userId || amount == null || !reason) {
      return NextResponse.json(
        { error: "userId, amount, and reason are required" },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
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

    // Build the exact profile update — we do this directly so the result is
    // always correct regardless of how the trigger routes credit_source.
    let profileUpdate: Record<string, number> = {};

    if (creditType === "earned") {
      if (currentEarned + amountNum < 0 || currentTotalBalance + amountNum < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current earned: ${currentEarned}, total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      profileUpdate = {
        earned_credits: Math.round((currentEarned + amountNum) * 100) / 100,
        credits_balance: Math.round((currentTotalBalance + amountNum) * 100) / 100,
      };
    } else if (creditType === "purchased") {
      if (currentPurchased + amountNum < 0 || currentTotalBalance + amountNum < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current purchased: ${currentPurchased}, total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      profileUpdate = {
        purchased_credits: Math.round((currentPurchased + amountNum) * 100) / 100,
        credits_balance: Math.round((currentTotalBalance + amountNum) * 100) / 100,
      };
    } else {
      if (currentTotalBalance + amountNum < 0) {
        return NextResponse.json(
          { error: `Cannot reduce balance below 0. Current total: ${currentTotalBalance}` },
          { status: 400 }
        );
      }
      profileUpdate = {
        credits_balance: Math.round((currentTotalBalance + amountNum) * 100) / 100,
      };
    }

    // Apply the profile update directly — precise and guaranteed correct.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
      return NextResponse.json({ error: "Failed to update balance" }, { status: 500 });
    }

    // NOTE: We intentionally do NOT insert a transactions row here.
    // The trigger on the transactions table fires on every insert and would
    // re-apply the amount, doubling the adjustment. The direct profile UPDATE
    // above is the sole source of truth for admin adjustments.

    // Fetch the updated profile to return accurate new balances
    const { data: updatedProfile } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance, earned_credits, purchased_credits")
      .eq("id", userId)
      .single();

    return NextResponse.json({
      success: true,
      newTotal: updatedProfile?.credits_balance ?? currentTotalBalance + amountNum,
      newBalance: creditType === "earned"
        ? updatedProfile?.earned_credits
        : creditType === "purchased"
          ? updatedProfile?.purchased_credits
          : updatedProfile?.credits_balance,
      creditType,
      message: `${creditType === "earned" ? "Earned credits" : creditType === "purchased" ? "Purchased credits" : "Balance"} adjusted by ${amountNum > 0 ? "+" : ""}${amountNum} credits`,
    });
  } catch (error) {
    console.error("Admin adjust balance error:", error);
    return NextResponse.json(
      { error: "Failed to adjust balance" },
      { status: 500 }
    );
  }
}
