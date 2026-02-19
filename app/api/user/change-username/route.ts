import supabaseAdmin from "@/lib/supabase-admin";

const USERNAME_CHANGE_COST = 5; // credits
const COOLDOWN_DAYS = 30;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { new_username } = await req.json();

    if (!new_username || typeof new_username !== "string") {
      return Response.json({ error: "Username is required" }, { status: 400 });
    }

    const trimmed = new_username.trim().toLowerCase();

    // Validate format: 3-20 chars, alphanumeric + underscore only
    if (!/^[a-z0-9_]{3,20}$/.test(trimmed)) {
      return Response.json(
        { error: "Username must be 3-20 characters, letters/numbers/underscores only" },
        { status: 400 }
      );
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("username, username_change_count, username_changed_at, credits_balance, purchased_credits, earned_credits")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.username === trimmed) {
      return Response.json({ error: "That is already your username" }, { status: 400 });
    }

    const changeCount = profile.username_change_count || 0;
    const isFree = changeCount === 0;

    // Check cooldown for paid changes
    if (!isFree && profile.username_changed_at) {
      const lastChange = new Date(profile.username_changed_at);
      const daysSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(COOLDOWN_DAYS - daysSince);
        return Response.json(
          { error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` },
          { status: 400 }
        );
      }
    }

    // Check credits for paid changes
    if (!isFree) {
      const totalCredits = (profile.purchased_credits || 0) + (profile.earned_credits || 0);
      if (totalCredits < USERNAME_CHANGE_COST) {
        return Response.json(
          { error: `You need ${USERNAME_CHANGE_COST} credits to change your username (you have ${totalCredits})` },
          { status: 400 }
        );
      }
    }

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();

    if (existing) {
      return Response.json({ error: "That username is already taken" }, { status: 409 });
    }

    // Deduct credits for paid changes (deduct from purchased first)
    if (!isFree) {
      const newPurchased = Math.max(0, (profile.purchased_credits || 0) - USERNAME_CHANGE_COST);
      const remainder = USERNAME_CHANGE_COST - ((profile.purchased_credits || 0) - newPurchased);
      const newEarned = Math.max(0, (profile.earned_credits || 0) - Math.max(0, remainder));
      const newBalance = (profile.credits_balance || 0) - USERNAME_CHANGE_COST;

      await supabaseAdmin
        .from("profiles")
        .update({ purchased_credits: newPurchased, earned_credits: newEarned, credits_balance: newBalance })
        .eq("id", userData.user.id);

      // Record transaction (trigger will NOT double-count since we updated directly)
      await supabaseAdmin.from("transactions").insert({
        user_id: userData.user.id,
        amount: -USERNAME_CHANGE_COST,
        description: `Username changed to @${trimmed}`,
        transaction_type: "username_change",
        credit_source: "purchased",
        can_cashout: false,
      });
    }

    // Update username
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: trimmed,
        username_change_count: changeCount + 1,
        username_changed_at: new Date().toISOString(),
      })
      .eq("id", userData.user.id);

    if (updateError) {
      // Unique constraint violation
      if (updateError.code === "23505") {
        return Response.json({ error: "That username is already taken" }, { status: 409 });
      }
      console.error("Username update error:", updateError);
      return Response.json({ error: "Failed to update username" }, { status: 500 });
    }

    return Response.json({
      success: true,
      username: trimmed,
      was_free: isFree,
      message: isFree
        ? `Username changed to @${trimmed} (free — 1 free change used)`
        : `Username changed to @${trimmed} (${USERNAME_CHANGE_COST} credits deducted)`,
    });
  } catch (error) {
    console.error("Username change error:", error);
    return Response.json({ error: "Failed to change username" }, { status: 500 });
  }
}
