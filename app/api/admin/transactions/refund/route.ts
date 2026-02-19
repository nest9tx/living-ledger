import supabaseAdmin from "@/lib/supabase-admin";

export async function POST(req: Request) {
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

    const { transaction_id, reason } = await req.json();
    if (!transaction_id)
      return Response.json({ error: "transaction_id required" }, { status: 400 });

    // Fetch the original transaction
    const { data: original, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, amount, description, transaction_type, credit_source, can_cashout, admin_refunded")
      .eq("id", transaction_id)
      .single();

    if (fetchError || !original)
      return Response.json({ error: "Transaction not found" }, { status: 404 });

    if (original.admin_refunded)
      return Response.json({ error: "This transaction has already been refunded" }, { status: 400 });

    // Only allow refunding debits (negative amounts)
    if (original.amount >= 0)
      return Response.json({ error: "Only debit (negative) transactions can be refunded" }, { status: 400 });

    const refundAmount = Math.abs(original.amount);

    // Determine which pile to return credits to.
    // The trigger will route based on credit_source:
    //   "earned"   → earned_credits + credits_balance
    //   "purchased" or "purchase" → purchased_credits + credits_balance
    //   anything else → credits_balance only
    const refundSource = original.credit_source || "purchased";

    // Insert the refund transaction — the UPDATE_BALANCE_TRIGGER handles restoring the balance
    const { data: refundTx, error: refundError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: original.user_id,
        amount: refundAmount,
        description: `Admin refund${reason ? ` (${reason})` : ""}: ${original.description}`,
        transaction_type: "admin_refund",
        credit_source: refundSource,
        can_cashout: false,
        refund_of_transaction_id: original.id,
      })
      .select("id")
      .single();

    if (refundError) {
      console.error("Refund insert error:", refundError);
      return Response.json({ error: refundError.message }, { status: 500 });
    }

    // Mark the original as refunded to prevent double-refunding
    await supabaseAdmin
      .from("transactions")
      .update({ admin_refunded: true })
      .eq("id", original.id);

    return Response.json({
      success: true,
      refund_transaction_id: refundTx.id,
      credits_returned: refundAmount,
      returned_to: refundSource,
    });
  } catch (err) {
    console.error("Admin refund transaction error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
