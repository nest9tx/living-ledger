import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const primarySelect = requestedType === "offer"
      ? "id, user_id, price_credits, title, quantity, is_physical, shipping_credits"
      : "id, user_id, budget_credits, title, quantity, is_physical, shipping_credits";
    const secondarySelect = requestedType === "offer"
      ? "id, user_id, budget_credits, title, quantity, is_physical, shipping_credits"
      : "id, user_id, price_credits, title, quantity, is_physical, shipping_credits";

    const { data: primaryPost, error: primaryError } = await supabaseAdmin
      .from(primaryTable)
      .select(primarySelect)
      .eq("id", postId)
      .maybeSingle();

    const { data: secondaryPost, error: secondaryError } = await supabaseAdmin
      .from(secondaryTable)
      .select(secondarySelect)
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
      console.error("Escrow fetch error:", {
        primaryError,
        secondaryError,
        postId,
        primaryTable,
        secondaryTable,
      });
      return Response.json(
        { error: "Database error while loading post" },
        { status: 500 }
      );
    }

    if (!post) {
      console.warn("Escrow post not found", {
        postId,
        requestedType,
        primaryTable,
        secondaryTable,
      });
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.user_id === userData.user.id) {
      return Response.json({ error: "Cannot purchase your own post" }, { status: 400 });
    }

    // Enforce quantity limit — count active (non-refunded/cancelled) escrows
    if (post.quantity != null) {
      const escrowField = postType === "offer" ? "offer_id" : "request_id";
      const { count: soldCount } = await supabaseAdmin
        .from("credit_escrow")
        .select("id", { count: "exact", head: true })
        .eq(escrowField, postId)
        .not("status", "in", '("refunded","cancelled")');
      if ((soldCount || 0) >= post.quantity) {
        return Response.json({ error: "This listing is sold out" }, { status: 400 });
      }
    }

    const baseCredits = ("price_credits" in post ? post.price_credits : post.budget_credits) as number;
    const physicalPost = post as { is_physical?: boolean | null; shipping_credits?: number | null };
    const shippingCredits = physicalPost.is_physical && physicalPost.shipping_credits
      ? physicalPost.shipping_credits : 0;
    const credits = (baseCredits || 0) + shippingCredits;
    const postTitle = "title" in post ? post.title : null;
    const titleSuffix = postTitle ? `: ${postTitle}` : "";
    const shippingSuffix = shippingCredits > 0 ? ` (${baseCredits} item + ${shippingCredits} shipping)` : "";
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

    // Mark the listing as sold out if all quantity slots are now filled
    if (post.quantity != null) {
      const escrowField = postType === "offer" ? "offer_id" : "request_id";
      const table = postType === "offer" ? "offers" : "requests";
      const { count: newSoldCount } = await supabaseAdmin
        .from("credit_escrow")
        .select("id", { count: "exact", head: true })
        .eq(escrowField, postId)
        .not("status", "in", '("refunded","cancelled")');
      if ((newSoldCount || 0) >= post.quantity) {
        await supabaseAdmin.from(table).update({ is_sold_out: true }).eq("id", postId);
      }
    }

    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: userData.user.id,
      amount: -credits,
      description: `Escrow hold for ${postType} #${postId}${titleSuffix}${shippingSuffix}`,
      transaction_type: "escrow_hold",
      related_offer_id: postType === "offer" ? postId : null,
      related_request_id: postType === "request" ? postId : null,
      can_cashout: false,
    });

    if (txError) {
      console.error("Transaction insert error:", txError);
      return Response.json({ error: "Failed to record transaction" }, { status: 500 });
    }

    // Create notification for the provider about new order
    const { error: notifyError } = await supabaseAdmin.rpc("create_notification", {
      target_user_id: post.user_id,
      notification_type: "new_order",
      notification_title: `New Order - ${post.title}`,
      notification_message: `You have a new order for "${post.title}". Credits are held in escrow until completion.`,
      escrow_id: escrow.id,
      offer_id: postType === "offer" ? postId : null,
      request_id: postType === "request" ? postId : null
    });

    if (notifyError) {
      console.error("Failed to create notification:", notifyError);
      // Don't fail the escrow creation if notification fails
    }

    // Send new-order email to the provider
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.livingledger.org";
      const ordersUrl = `${siteUrl}/dashboard`;
      const listingUrl = postType === "offer"
        ? `${siteUrl}/listing/offer/${postId}`
        : `${siteUrl}/listing/request/${postId}`;

      const [{ data: providerAuth }, { data: buyerProfile }, { data: providerProfile }] =
        await Promise.all([
          supabaseAdmin.auth.admin.getUserById(post.user_id),
          supabaseAdmin.from("profiles").select("username").eq("id", userData.user.id).single(),
          supabaseAdmin.from("profiles").select("username").eq("id", post.user_id).single(),
        ]);

      const providerEmail = providerAuth?.user?.email;
      const buyerUsername = buyerProfile?.username || "A buyer";
      const providerUsername = providerProfile?.username || "there";
      const listingTitle = post.title || `${postType} #${postId}`;

      if (providerEmail) {
        await resend.emails.send({
          from: "Living Ledger <support@livingledger.org>",
          to: [providerEmail],
          subject: `📦 New Order – ${listingTitle}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
              <div style="padding: 32px 0 16px;">
                <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 8px;">You have a new order! 🎉</h2>
                <p style="color: #555; margin: 0;">Hey ${providerUsername}, someone just placed an order on your listing.</p>
              </div>

              <div style="background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 16px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #555; font-size: 14px;">Listing</td>
                    <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500;">${listingTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #555; font-size: 14px;">Ordered by</td>
                    <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500;">${buyerUsername}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #555; font-size: 14px;">Credits in escrow</td>
                    <td style="padding: 6px 0; font-size: 14px; text-align: right; font-weight: 500; color: #16a34a;">${credits} credits ($${credits}.00)</td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                The credits are safely held in escrow and will be released to you once the work is marked complete.
                Log in to confirm the order and get started.
              </p>

              <div style="margin: 24px 0; display: flex; gap: 12px;">
                <a href="${ordersUrl}"
                   style="display: inline-block; background: #111; color: #fff; text-decoration: none;
                          padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                  View your orders
                </a>
                &nbsp;&nbsp;
                <a href="${listingUrl}"
                   style="display: inline-block; border: 1px solid #ddd; color: #111; text-decoration: none;
                          padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                  View listing
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
              <p style="font-size: 12px; color: #999; margin: 0;">
                You're receiving this because you have a listing on
                <a href="${siteUrl}" style="color: #999;">Living Ledger</a>.
              </p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("new-order email error:", emailErr);
      // Email failure never blocks the order
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
