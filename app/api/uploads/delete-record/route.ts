import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

export async function DELETE(req: Request) {
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
    const { type, record_id } = body;

    if (!type || !record_id) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = userData.user.id;

    // Delete record based on upload type
    if (type === "listing") {
      const { error } = await supabaseAdmin
        .from("listing_images")
        .delete()
        .eq("id", record_id)
        .eq("user_id", userId); // Ensure user owns the record

      if (error) {
        console.error("Failed to delete listing image record:", error);
        return Response.json({ error: "Failed to delete image record" }, { status: 500 });
      }

    } else if (type === "message") {
      const { error } = await supabaseAdmin
        .from("message_attachments")
        .delete()
        .eq("id", record_id)
        .eq("user_id", userId); // Ensure user owns the record

      if (error) {
        console.error("Failed to delete message attachment record:", error);
        return Response.json({ error: "Failed to delete attachment record" }, { status: 500 });
      }

    } else if (type === "delivery") {
      // Define interface for the expected data structure
      interface DeliveryFileWithEscrow {
        provider_id: string;
        escrow_id: number;
        credit_escrow: { status: string } | null;
      }
      
      // For delivery files, also check that escrow is still in 'held' status
      const { data: deliveryFile, error: fetchError } = await supabaseAdmin
        .from("delivery_files")
        .select(`
          provider_id,
          escrow_id,
          credit_escrow(
            status
          )
        `)
        .eq("id", record_id)
        .single() as { data: DeliveryFileWithEscrow | null; error: Error | null };

      if (fetchError || !deliveryFile) {
        return Response.json({ error: "Delivery file not found" }, { status: 404 });
      }

      if (deliveryFile.provider_id !== userId) {
        return Response.json({ error: "Access denied" }, { status: 403 });
      }

      // Access the nested credit_escrow data
      const escrowStatus = deliveryFile.credit_escrow?.status;
      if (escrowStatus !== "held") {
        return Response.json({ error: "Cannot delete delivery files after completion" }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from("delivery_files")
        .delete()
        .eq("id", record_id);

      if (error) {
        console.error("Failed to delete delivery file record:", error);
        return Response.json({ error: "Failed to delete delivery record" }, { status: 500 });
      }

    } else {
      return Response.json({ error: "Invalid upload type" }, { status: 400 });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error("Upload record deletion error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}