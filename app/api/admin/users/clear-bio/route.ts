import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/users/clear-bio
 *
 * Clears a user's bio. Admin only.
 * Body: { userId: string }
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(token: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin ? user : null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await verifyAdmin(authHeader.substring(7));
    if (!admin) {
      return NextResponse.json({ error: "Admin access denied" }, { status: 403 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ bio: null })
      .eq("id", userId);

    if (error) {
      console.error("Clear bio error:", error);
      return NextResponse.json({ error: "Failed to clear bio" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Bio cleared successfully." });
  } catch (err) {
    console.error("Admin clear-bio error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
