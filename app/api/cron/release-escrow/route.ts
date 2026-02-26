import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabase-admin";

/**
 * GET /api/cron/release-escrow
 *
 * Called daily by Vercel Cron (configured in vercel.json).
 * Auto-releases any escrow where:
 *   - Both parties have confirmed (payer_confirmed_at + provider_confirmed_at set)
 *   - The 7-day safety window has passed (release_available_at <= now)
 *   - Status is not disputed, released, or refunded
 *
 * Protected by CRON_SECRET so it can't be triggered by random visitors.
 */

const PLATFORM_FEE_RATE = 0.10;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // Find all escrows that are ready to auto-release
    const { data: eligible, error: fetchError } = await supabaseAdmin
      .from("credit_escrow")
      .select("*")
      .not("payer_confirmed_at", "is", null)
      .not("provider_confirmed_at", "is", null)
      .lte("release_available_at", now)
      .not("status", "in", '("released","refunded","disputed","cancelled")');

    if (fetchError) {
      console.error("cron/release-escrow fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to query escrows" }, { status: 500 });
    }

    const toRelease = eligible || [];
    let released = 0;
    let failed = 0;

    for (const escrow of toRelease) {
      try {
        const credits = (escrow.credits_held || 0) as number;
        if (credits <= 0) continue;

        const platformFee = Math.round(credits * PLATFORM_FEE_RATE * 100) / 100;
        const providerCredits = Math.round((credits - platformFee) * 100) / 100;

        // Mark escrow as released
        const { error: updateError } = await supabaseAdmin
          .from("credit_escrow")
          .update({ status: "released", released_at: now })
          .eq("id", escrow.id);

        if (updateError) {
          console.error(`Failed to update escrow ${escrow.id}:`, updateError);
          failed++;
          continue;
        }

        // Award full amount to provider as earned
        const { error: earnError } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: escrow.provider_id,
            amount: credits,
            transaction_type: "earned",
            credit_source: "earned",
            description: `Escrow auto-released — ${escrow.offer_id ? `Offer #${escrow.offer_id}` : `Request #${escrow.request_id}`} (${credits} credits)`,
            related_offer_id: escrow.offer_id ?? null,
            related_request_id: escrow.request_id ?? null,
            can_cashout: true,
          });

        if (earnError) {
          console.error(`Failed to insert earned tx for escrow ${escrow.id}:`, earnError);
        }

        // Deduct platform fee
        if (platformFee > 0) {
          const { error: feeError } = await supabaseAdmin
            .from("transactions")
            .insert({
              user_id: escrow.provider_id,
              amount: -platformFee,
              transaction_type: "platform_fee",
              credit_source: "earned",
              description: `Platform fee (${Math.round(PLATFORM_FEE_RATE * 100)}%) — auto-release escrow #${escrow.id}`,
              related_offer_id: escrow.offer_id ?? null,
              related_request_id: escrow.request_id ?? null,
              can_cashout: false,
            });

          if (feeError) {
            console.error(`Failed to insert fee tx for escrow ${escrow.id}:`, feeError);
          }
        }

        // Notify provider — failure never blocks the release
        try {
          await supabaseAdmin.rpc("create_notification", {
            target_user_id: escrow.provider_id,
            notification_type: "escrow_released",
            notification_title: "Funds Released",
            notification_message: `${providerCredits} credits have been released to your account from escrow #${escrow.id}.`,
            escrow_id: escrow.id,
            offer_id: escrow.offer_id ?? null,
            request_id: escrow.request_id ?? null,
          });
        } catch {
          // swallow — notification is best-effort
        }

        released++;
        console.log(`cron/release-escrow: released escrow #${escrow.id} — ${providerCredits} credits to provider`);
      } catch (err) {
        console.error(`Error releasing escrow ${escrow.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({ success: true, released, failed, total: toRelease.length });
  } catch (err) {
    console.error("cron/release-escrow error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
