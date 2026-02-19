import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;
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
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const limit = 50;
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search") || "";

    let query = supabaseAdmin
      .from("transactions")
      .select("id, user_id, amount, description, transaction_type, credit_source, can_cashout, admin_refunded, refund_of_transaction_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("description", `%${search}%`);
    }

    const { data: transactions, error: txError, count } = await query;

    if (txError) return Response.json({ error: txError.message }, { status: 500 });

    // Resolve usernames for all unique user IDs
    const userIds = [...new Set((transactions || []).map((t) => t.user_id).filter(Boolean))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    const usernameMap = (profiles || []).reduce(
      (acc, p) => { acc[p.id] = p.username; return acc; },
      {} as Record<string, string>
    );

    // Resolve emails for user IDs we couldn't match to a username
    const emailMap: Record<string, string> = {};
    for (const uid of userIds) {
      if (!usernameMap[uid]) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (authUser?.user?.email) emailMap[uid] = authUser.user.email;
        } catch {}
      }
    }

    const enriched = (transactions || []).map((t) => ({
      ...t,
      username: usernameMap[t.user_id] || emailMap[t.user_id] || "Unknown",
    }));

    return Response.json({ transactions: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    console.error("Admin transactions list error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
