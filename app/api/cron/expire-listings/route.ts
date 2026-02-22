import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabase-admin";

/**
 * GET /api/cron/expire-listings
 *
 * Called daily by Vercel Cron (configured in vercel.json).
 * Marks any listings past their expires_at as is_active = false
 * so they stop showing in the public feed.
 *
 * Protected by CRON_SECRET so it can't be triggered by random visitors.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    const [offersResult, requestsResult] = await Promise.all([
      supabaseAdmin
        .from("offers")
        .update({ is_active: false })
        .eq("is_active", true)
        .lt("expires_at", now)
        .select("id"),

      supabaseAdmin
        .from("requests")
        .update({ is_active: false })
        .eq("is_active", true)
        .lt("expires_at", now)
        .select("id"),
    ]);

    const expiredOffers = offersResult.data?.length ?? 0;
    const expiredRequests = requestsResult.data?.length ?? 0;

    console.log(`cron/expire-listings: expired ${expiredOffers} offers, ${expiredRequests} requests`);

    return NextResponse.json({
      success: true,
      expired: { offers: expiredOffers, requests: expiredRequests },
    });
  } catch (err) {
    console.error("cron/expire-listings error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
