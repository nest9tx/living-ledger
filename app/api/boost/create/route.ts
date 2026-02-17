import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const HOMEPAGE_DAILY_COST = 10;
const CATEGORY_DAILY_COST = 5;
const CATEGORY_THREE_DAY_COST = 10;

const HOMEPAGE_COOLDOWN_HOURS = 48;
const CATEGORY_COOLDOWN_HOURS = 24;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const postId = Number(body?.postId);
    const postType = body?.postType === "offer" ? "offer" : body?.postType === "request" ? "request" : null;
    const tier = body?.tier === "homepage" ? "homepage" : body?.tier === "category" ? "category" : null;
    const durationDays = Number(body?.durationDays || 1);

    if (!Number.isFinite(postId) || !postType || !tier) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (tier === "homepage" && durationDays !== 1) {
      return Response.json({ error: "Homepage boosts are 24 hours only" }, { status: 400 });
    }

    if (tier === "category" && durationDays !== 1 && durationDays !== 3) {
      return Response.json({ error: "Category boosts must be 1 or 3 days" }, { status: 400 });
    }

    // Fetch post and validate ownership
    const table = postType === "offer" ? "offers" : "requests";
    const { data: post, error: postError } = await supabaseAdmin
      .from(table)
      .select("id, user_id, title, category_id, last_boosted_homepage_at, last_boosted_category_at")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.user_id !== userData.user.id) {
      return Response.json({ error: "You can only boost your own listings" }, { status: 403 });
    }

    // Enforce cooldown
    const lastBoostedAt = tier === "homepage" ? post.last_boosted_homepage_at : post.last_boosted_category_at;
    if (lastBoostedAt) {
      const lastBoosted = new Date(lastBoostedAt).getTime();
      const cooldownHours = tier === "homepage" ? HOMEPAGE_COOLDOWN_HOURS : CATEGORY_COOLDOWN_HOURS;
      const cooldownUntil = lastBoosted + cooldownHours * 60 * 60 * 1000;

      if (Date.now() < cooldownUntil) {
        return Response.json({
          error: `This listing was boosted recently. Please wait ${cooldownHours} hours before boosting again.`,
        }, { status: 400 });
      }
    }

    // Calculate cost
    let creditsSpent = 0;
    if (tier === "homepage") {
      creditsSpent = HOMEPAGE_DAILY_COST;
    } else if (durationDays === 1) {
      creditsSpent = CATEGORY_DAILY_COST;
    } else {
      creditsSpent = CATEGORY_THREE_DAY_COST;
    }

    // Ensure user has credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userData.user.id)
      .maybeSingle();

    const balance = profile?.credits_balance || 0;
    if (balance < creditsSpent) {
      return Response.json({ error: "Insufficient credits" }, { status: 400 });
    }

    // Count active boosts for user (respect limits)
    const { data: activeBoosts } = await supabaseAdmin
      .from("listing_boosts")
      .select("id, boost_tier")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString());

    const activeList = activeBoosts || [];
    const totalActive = activeList.length;
    const homepageActive = activeList.filter((b) => b.boost_tier === "homepage").length;
    const categoryActive = activeList.filter((b) => b.boost_tier === "category").length;

    if (totalActive >= 5) {
      return Response.json({ error: "Boost limit reached (max 5 active)" }, { status: 400 });
    }

    if (tier === "homepage" && homepageActive >= 2) {
      return Response.json({ error: "Homepage boost limit reached (max 2 active)" }, { status: 400 });
    }

    if (tier === "category" && categoryActive >= 3) {
      return Response.json({ error: "Category boost limit reached (max 3 active)" }, { status: 400 });
    }

    // Check global homepage slot availability (max 8 total across all users)
    if (tier === "homepage") {
      const { data: globalHomepageBoosts, error: globalError } = await supabaseAdmin
        .from("listing_boosts")
        .select("id, expires_at")
        .eq("boost_tier", "homepage")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (globalError) {
        console.error("Error checking global homepage slots:", globalError);
      } else if (globalHomepageBoosts && globalHomepageBoosts.length >= 8) {
        // Find when the next slot opens (soonest expiry)
        const soonestExpiry = globalHomepageBoosts
          .map(b => new Date(b.expires_at).getTime())
          .sort((a, b) => a - b)[0];
        
        const hoursUntilSlot = Math.ceil((soonestExpiry - Date.now()) / (1000 * 60 * 60));
        
        return Response.json({
          error: `Homepage boosts are currently full (8/8 slots active). Next slot opens in approximately ${hoursUntilSlot} hour${hoursUntilSlot > 1 ? 's' : ''}. Try boosting in a specific category instead!`
        }, { status: 400 });
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // Create boost record
    const { error: boostError } = await supabaseAdmin
      .from("listing_boosts")
      .insert({
        user_id: userData.user.id,
        post_type: postType,
        post_id: postId,
        boost_tier: tier,
        category_id: post.category_id || null,
        credits_spent: creditsSpent,
        duration_hours: durationDays * 24,
        started_at: now.toISOString(),
        expires_at: expiresAt,
        is_active: true,
      });

    if (boostError) {
      console.error("Boost create error:", boostError);
      return Response.json({ error: "Failed to create boost" }, { status: 500 });
    }

    const titleSuffix = post?.title ? `: ${post.title}` : "";

    // Deduct credits via transaction
    const { error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userData.user.id,
        amount: -creditsSpent,
        description: `${tier === "homepage" ? "Homepage" : "Category"} boost (${durationDays} day${durationDays > 1 ? "s" : ""}) for ${postType} #${postId}${titleSuffix}`,
        transaction_type: "boost",
        related_offer_id: postType === "offer" ? postId : null,
        related_request_id: postType === "request" ? postId : null,
        can_cashout: false,
      });

    if (transactionError) {
      console.error("Boost transaction error:", transactionError);
      return Response.json({ error: "Failed to charge credits" }, { status: 500 });
    }

    // Update last_boosted_at
    const cooldownField = tier === "homepage" ? "last_boosted_homepage_at" : "last_boosted_category_at";
    await supabaseAdmin
      .from(table)
      .update({ [cooldownField]: now.toISOString() })
      .eq("id", postId);

    return Response.json({ success: true, expiresAt, creditsSpent });
  } catch (error) {
    console.error("Boost create error:", error);
    return Response.json({ error: "Failed to create boost" }, { status: 500 });
  }
}
