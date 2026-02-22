import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/users/set-status
 *
 * Sets a user's account status. Admin only.
 *
 * Body: {
 *   userId: string,
 *   status: "active" | "suspended" | "banned",
 *   reason?: string
 * }
 *
 * - "suspended": sets account_status in profiles; user can log in but
 *   the app should gate posting/ordering on account_status === "active"
 * - "banned": sets account_status + calls Supabase Auth ban (prevents login)
 * - "active": lifts suspension/ban
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

    const body = await req.json();
    const { userId, status, reason } = body;

    if (!userId || !status) {
      return NextResponse.json({ error: "userId and status are required" }, { status: 400 });
    }

    if (!["active", "suspended", "banned"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    // Prevent admin from suspending/banning themselves
    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot change your own account status." }, { status: 400 });
    }

    // Fetch target user to confirm they exist and are not admin
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, username, is_admin")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetProfile.is_admin) {
      return NextResponse.json({ error: "Cannot suspend or ban another admin." }, { status: 400 });
    }

    // Build profile update
    const profileUpdate: Record<string, unknown> = {
      account_status: status,
      suspension_reason: status === "active" ? null : (reason?.trim() || null),
      suspended_at: status === "active" ? null : new Date().toISOString(),
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (profileError) {
      console.error("Set status profile update error:", profileError);
      return NextResponse.json({ error: "Failed to update account status" }, { status: 500 });
    }

    // For bans: also block the Supabase Auth user so they cannot log in
    if (status === "banned") {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876600h", // ~100 years
      });
      if (banError) {
        // Non-fatal — profile status is already set; log and continue
        console.error("Supabase auth ban error:", banError);
      }
    }

    // For lifting a ban: also unban in Supabase Auth
    if (status === "active") {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
      if (unbanError) {
        // Non-fatal — profile status is already restored
        console.error("Supabase auth unban error:", unbanError);
      }
    }

    const statusLabels: Record<string, string> = {
      active: "Account restored to active.",
      suspended: `@${targetProfile.username} has been suspended.`,
      banned: `@${targetProfile.username} has been banned and can no longer log in.`,
    };

    return NextResponse.json({ success: true, message: statusLabels[status] });
  } catch (err) {
    console.error("Admin set-status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
