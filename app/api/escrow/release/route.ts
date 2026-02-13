import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const PLATFORM_FEE_RATE = 0.15;

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
    const escrowId = Number(body?.escrowId);

    if (!Number.isFinite(escrowId)) {
      return Response.json({ error: "Invalid escrow" }, { status: 400 });
    }

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select(
        "id, payer_id, provider_id, credits_held, status, release_available_at, offer_id, request_id"
      )
      .eq("id", escrowId)
      .maybeSingle();

    if (escrowError || !escrow) {
      return Response.json({ error: "Escrow not found" }, { status: 404 });
    }

    if (escrow.status === "released") {
      return Response.json({ error: "Escrow already released" }, { status: 400 });
    }

    const isPayer = escrow.payer_id === userData.user.id;
    const isProvider = escrow.provider_id === userData.user.id;

    if (!isPayer && !isProvider) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const availableAt = escrow.release_available_at
      ? new Date(escrow.release_available_at).getTime()
      : null;

    if (isProvider && availableAt && Date.now() < availableAt) {
      return Response.json({ error: "Release available after safety delay" }, { status: 400 });
    }

    if (isPayer && escrow.status !== "delivered") {
      return Response.json({ error: "Awaiting delivery confirmation" }, { status: 400 });
    }

    const credits = escrow.credits_held || 0;
    if (credits < 1) {
      return Response.json({ error: "Invalid escrow amount" }, { status: 400 });
    }

    const fee = Math.round(credits * PLATFORM_FEE_RATE);
    const providerCredits = Math.max(credits - fee, 0);

    const { error: earnedError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: escrow.provider_id,
        amount: providerCredits,
        description: `Escrow release (${credits})`,
        transaction_type: "earned",
        related_offer_id: escrow.offer_id,
        related_request_id: escrow.request_id,
        can_cashout: true,
      });

    if (earnedError) {
      console.error("Provider credit error:", earnedError);
      return Response.json({ error: "Failed to credit provider" }, { status: 500 });
    }

    if (fee > 0) {
      const { error: feeError } = await supabaseAdmin
        .from("transactions")
        .insert({
          user_id: escrow.provider_id,
          amount: -fee,
          description: `Platform fee (15%)`,
          transaction_type: "platform_fee",
          related_offer_id: escrow.offer_id,
          related_request_id: escrow.request_id,
          can_cashout: false,
        });

      if (feeError) {
        console.error("Platform fee error:", feeError);
        return Response.json({ error: "Failed to apply platform fee" }, { status: 500 });
      }
    }

    const updatePayload = {
      status: "released",
      released_at: new Date().toISOString(),
      buyer_confirmed_at: isPayer ? new Date().toISOString() : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("credit_escrow")
      .update(updatePayload)
      .eq("id", escrowId);

    if (updateError) {
      console.error("Escrow update error:", updateError);
      return Response.json({ error: "Failed to release escrow" }, { status: 500 });
    }

    return Response.json({
      escrowId: escrow.id,
      creditsReleased: providerCredits,
      feeApplied: fee,
    });
  } catch (error) {
    console.error("Escrow release error:", error);
    return Response.json({ error: "Failed to release escrow" }, { status: 500 });
  }
}
