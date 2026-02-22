import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabase-admin";

const RENEW_DAYS = 30;

/**
 * POST /api/listing/renew
 *
 * Extends a request or offer listing by RENEW_DAYS from today.
 * Free for users — no credits deducted.
 * Only the listing owner can renew their own listing.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = Number(body?.id);
    const type = body?.type === "offer" ? "offer" : body?.type === "request" ? "request" : null;

    if (!Number.isFinite(id) || !type) {
      return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
    }

    const table = type === "offer" ? "offers" : "requests";

    // Verify ownership
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from(table)
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extend from today (so an already-expired listing gets a full fresh 30 days)
    const newExpiry = new Date(Date.now() + RENEW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({ expires_at: newExpiry, is_active: true })
      .eq("id", id);

    if (updateError) {
      console.error("renew listing error:", updateError);
      return NextResponse.json({ error: "Failed to renew listing" }, { status: 500 });
    }

    return NextResponse.json({ success: true, expires_at: newExpiry });
  } catch (err) {
    console.error("renew unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
