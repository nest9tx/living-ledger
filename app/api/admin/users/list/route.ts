import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/users/list
 * 
 * Returns list of users with profile data for admin management.
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

    // Fetch users with profile data
    const { data: users, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        username,
        bio,
        credits_balance,
        earned_credits,
        purchased_credits,
        average_rating,
        total_ratings,
        total_contributions,
        onboarding_complete,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (usersError) {
      console.error("Users fetch error:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users", details: usersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      users: users || [],
    });
  } catch (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users list" },
      { status: 500 }
    );
  }
}
