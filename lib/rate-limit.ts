import { createClient } from "@supabase/supabase-js";

/**
 * Database-backed rate limiter using the `rate_limit_log` Postgres table.
 *
 * Works correctly across ALL Vercel serverless instances — the previous
 * in-memory Map was per-process and was reset on every cold start.
 *
 * Requires the ADD_RATE_LIMIT_TABLE.sql migration to have been run.
 *
 * Fails OPEN on DB errors so a transient Supabase hiccup never blocks
 * legitimate users. A real attack would have to survive the business-logic
 * guards (balance check, duplicate detection) even if rate limiting is
 * briefly unavailable.
 */

// Lazy admin client — only instantiated when the module is first used
// inside an API route (where the env vars are always present).
let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

/**
 * Check whether a request should be allowed.
 *
 * @param identifier - Unique key per actor (e.g. `userId` or IP address)
 * @param limit      - Maximum requests allowed within the window
 * @param windowMs   - Rolling window length in milliseconds
 *
 * @returns `success: true` if the request is within limits, `false` if exceeded.
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number }> {
  try {
    const admin = getAdmin();
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    // Count hits within the window for this key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error: countError } = await (admin as any)
      .from("rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("key", identifier)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("rate-limit count error:", countError);
      return { success: true, remaining: limit }; // fail open
    }

    const current = count ?? 0;

    if (current >= limit) {
      return { success: false, remaining: 0 };
    }

    // Record this hit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (admin as any)
      .from("rate_limit_log")
      .insert({ key: identifier });

    if (insertError) {
      console.error("rate-limit insert error:", insertError);
      return { success: true, remaining: limit - current }; // fail open
    }

    // Lazily prune entries older than 2× the window (fire-and-forget)
    const pruneOlderThan = new Date(Date.now() - windowMs * 2).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (admin as any)
      .from("rate_limit_log")
      .delete()
      .lt("created_at", pruneOlderThan);

    return { success: true, remaining: limit - current - 1 };
  } catch (err) {
    console.error("rate-limit unexpected error:", err);
    return { success: true, remaining: limit }; // fail open
  }
}
