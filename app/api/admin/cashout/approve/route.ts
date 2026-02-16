import supabaseAdmin from "@/lib/supabase-admin";
import supabase from "@/lib/supabase";

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

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (!admin?.is_admin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { cashout_id, admin_note } = await req.json();

    if (!cashout_id) {
      return Response.json({ error: "Cashout ID required" }, { status: 400 });
    }

    // Get cashout request
    const { data: cashout } = await supabaseAdmin
      .from("cashout_requests")
      .select("*")
      .eq("id", cashout_id)
      .single();

    if (!cashout) {
      return Response.json({ error: "Cashout request not found" }, { status: 404 });
    }

    if (cashout.status !== "pending") {
      return Response.json(
        { error: `Cannot approve cashout with status: ${cashout.status}` },
        { status: 400 }
      );
    }

    // Update cashout request to approved
    const { error: updateError } = await supabaseAdmin
      .from("cashout_requests")
      .update({
        status: "approved",
        admin_id: userData.user.id,
        admin_note: admin_note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", cashout_id);

    if (updateError) {
      console.error("Cashout update error:", updateError);
      return Response.json({ error: "Failed to approve cashout" }, { status: 500 });
    }

    // Record transaction for approved cashout
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: cashout.user_id,
        amount: -cashout.amount_credits,
        description: `Cashout approved by admin ($${cashout.amount_credits})`,
        transaction_type: "cashout_approved",
        credit_source: "earned",
        can_cashout: false,
      });

    if (txError) {
      console.error("Transaction error:", txError);
    }

    return Response.json({
      success: true,
      cashoutId: cashout_id,
      status: "approved",
      message: "Cashout approved. Pending payout to user's bank account.",
    });
  } catch (error) {
    console.error("Admin approve cashout error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to approve cashout" },
      { status: 500 }
    );
  }
}
