import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/stats
 * 
 * Returns real-time platform statistics for admin dashboard.
 * Requires admin authentication.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
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

    // Fetch real statistics in parallel
    const [
      usersResult,
      offersResult,
      requestsResult,
      creditsResult,
      feesResult,
      disputesResult,
    ] = await Promise.all([
      // Total users
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      
      // Active offers
      supabaseAdmin.from("offers").select("id", { count: "exact", head: true }),
      
      // Active requests
      supabaseAdmin.from("requests").select("id", { count: "exact", head: true }),
      
      // Total credits in circulation (sum of all balances)
      supabaseAdmin.from("profiles").select("credits_balance"),
      
      // Platform revenue (sum of fee transactions)
      supabaseAdmin
        .from("transactions")
        .select("amount")
        .eq("transaction_type", "fee"),
      
      // Open disputes
      supabaseAdmin
        .from("credit_escrow")
        .select("id", { count: "exact", head: true })
        .eq("dispute_status", "open"),
    ]);

    // Calculate totals
    const totalUsers = usersResult.count || 0;
    const activeListings = (offersResult.count || 0) + (requestsResult.count || 0);
    
    const totalCreditsFlowing = creditsResult.data?.reduce(
      (sum, p) => sum + (p.credits_balance || 0),
      0
    ) || 0;
    
    const platformRevenue = feesResult.data?.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    ) || 0;
    
    const openDisputes = disputesResult.count || 0;

    // Flagged items - not implemented yet, set to 0
    const flaggedItems = 0;

    return NextResponse.json({
      stats: {
        totalUsers,
        activeListings,
        totalCreditsFlowing,
        platformRevenue,
        flaggedItems,
        openDisputes,
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
