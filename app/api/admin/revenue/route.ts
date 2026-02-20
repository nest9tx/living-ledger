import supabaseAdmin from "@/lib/supabase-admin";

/**
 * GET /api/admin/revenue?range=7d
 *
 * range options: 1d | 7d | 30d | mtd | all
 *
 * Returns:
 *  - total: total revenue for the period
 *  - byType: { platform_fee: number; boost: number }
 *  - daily: { date: string; amount: number }[]  (newest first)
 *  - recentTransactions: enriched transaction rows
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!admin?.is_admin)
      return Response.json({ error: "Forbidden" }, { status: 403 });

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "30d";

    // Compute the start date based on range
    let since: string | null = null;
    const now = new Date();
    if (range === "1d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      since = d.toISOString();
    } else if (range === "7d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      since = d.toISOString();
    } else if (range === "30d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      since = d.toISOString();
    } else if (range === "mtd") {
      // Month-to-date
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      since = d.toISOString();
    }
    // range === "all" → no filter

    let query = supabaseAdmin
      .from("transactions")
      .select("id, user_id, amount, description, transaction_type, created_at")
      .in("transaction_type", ["platform_fee", "boost"])
      .order("created_at", { ascending: false });

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data: rows, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const transactions = rows || [];

    // Totals
    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const byType = {
      platform_fee: transactions
        .filter((t) => t.transaction_type === "platform_fee")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      boost: transactions
        .filter((t) => t.transaction_type === "boost")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    };

    // Daily breakdown (group by UTC date)
    const dailyMap: Record<string, number> = {};
    for (const t of transactions) {
      const day = t.created_at.slice(0, 10); // "YYYY-MM-DD"
      dailyMap[day] = (dailyMap[day] ?? 0) + Math.abs(t.amount);
    }
    const daily = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first

    // Resolve usernames for the recent transaction list
    const userIds = [...new Set(transactions.map((t) => t.user_id).filter(Boolean))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    const usernameMap = (profiles || []).reduce(
      (acc, p) => { acc[p.id] = p.username; return acc; },
      {} as Record<string, string>
    );

    const recentTransactions = transactions.slice(0, 100).map((t) => ({
      ...t,
      username: usernameMap[t.user_id] || "Unknown",
    }));

    return Response.json({ total, byType, daily, recentTransactions });
  } catch (err) {
    console.error("Admin revenue error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
