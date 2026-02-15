import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const ESCROW_DELAY_DAYS = 7;

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
    const requestedType = body?.postType === "offer" ? "offer" : "request";
    const postId = Number(body?.postId);

    if (!Number.isFinite(postId)) {
      return Response.json({ error: "Invalid post" }, { status: 400 });
    }

    const primaryTable = requestedType === "offer" ? "offers" : "requests";
    const secondaryTable = requestedType === "offer" ? "requests" : "offers";

    const { data: primaryPost, error: primaryError } = await supabaseAdmin
      .from(primaryTable)
      .select("id, user_id, price_credits, budget_credits")
      .eq("id", postId)
      .maybeSingle();

    const { data: secondaryPost, error: secondaryError } = await supabaseAdmin
      .from(secondaryTable)
      .select("id, user_id, price_credits, budget_credits")
      .eq("id", postId)
      .maybeSingle();

    const post = primaryPost || secondaryPost;
    const postType = primaryPost
      ? requestedType
      : secondaryPost
        ? requestedType === "offer"
          ? "request"
          : "offer"
        : requestedType;

    if (primaryError || secondaryError) {
      console.error("Escrow fetch error:", primaryError || secondaryError);
    }

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.user_id === userData.user.id) {
      return Response.json({ error: "Cannot purchase your own post" }, { status: 400 });
    }

    const credits = postType === "offer" ? post.price_credits : post.budget_credits;
    if (!credits || credits < 1) {
      return Response.json({ error: "Invalid credit amount" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits_balance")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return Response.json({ error: "Unable to verify balance" }, { status: 500 });
    }

    if ((profile.credits_balance || 0) < credits) {
      return Response.json({ error: "Insufficient credits" }, { status: 400 });
    }

    const releaseAt = new Date(
      Date.now() + ESCROW_DELAY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const escrowPayload = {
      payer_id: userData.user.id,
      provider_id: post.user_id,
      credits_held: credits,
      status: "held",
      release_available_at: releaseAt,
      request_id: postType === "request" ? postId : null,
      offer_id: postType === "offer" ? postId : null,
    };

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .insert(escrowPayload)
      .select()
      .single();

    if (escrowError) {
      console.error("Escrow insert error:", escrowError);
      return Response.json({ error: "Failed to hold credits" }, { status: 500 });
    }

    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: userData.user.id,
      amount: -credits,
      description: `Escrow hold for ${postType} #${postId}`,
      transaction_type: "escrow_hold",
      related_offer_id: postType === "offer" ? postId : null,
      related_request_id: postType === "request" ? postId : null,
      can_cashout: false,
    });

    if (txError) {
      console.error("Transaction insert error:", txError);
      return Response.json({ error: "Failed to record transaction" }, { status: 500 });
    }

    return Response.json({
      escrowId: escrow.id,
      creditsHeld: credits,
      releaseAvailableAt: releaseAt,
      status: escrow.status,
    });
  } catch (error) {
    console.error("Escrow create error:", error);
    return Response.json({ error: "Failed to create escrow" }, { status: 500 });
  }
}
