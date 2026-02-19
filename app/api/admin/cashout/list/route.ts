import supabaseAdmin from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (!admin?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";

    // Get cashout requests
    let query = supabaseAdmin
      .from("cashout_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data: cashouts, error: cashoutError } = await query;

    if (cashoutError) {
      console.error("Cashout fetch error:", cashoutError);
      return Response.json({ error: "Failed to load cashout requests" }, { status: 500 });
    }

    // Get user profiles for context (email lives in auth.users, not profiles)
    const userIds = cashouts?.map((c) => c.user_id) || [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username, earned_credits, purchased_credits, stripe_account_id, stripe_account_status, stripe_onboarding_complete")
      .in("id", userIds);

    // Fetch emails from auth.users
    const emailMap: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (data?.user?.email) emailMap[uid] = data.user.email;
      })
    );

    const profileMap = (profiles || []).reduce(
      (acc, p) => {
        acc[p.id] = { ...p, email: emailMap[p.id] ?? null };
        return acc;
      },
      {} as Record<string, { id: string; username: string; email: string | null; earned_credits: number; purchased_credits: number; stripe_account_id: string | null; stripe_account_status: string | null; stripe_onboarding_complete: boolean }>
    );

    const items = (cashouts || []).map((c) => ({
      ...c,
      user: profileMap[c.user_id],
    }));

    return Response.json({ cashouts: items });
  } catch (error) {
    console.error("Admin cashout list error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load cashout requests" },
      { status: 500 }
    );
  }
}
