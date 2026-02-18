import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

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
    const {
      type,
      storage_path,
      filename,
      file_size,
      mime_type,
      listing_id,
      listing_type,
      message_id,
      escrow_id,
    } = body;

    if (!type || !storage_path || !filename || !file_size || !mime_type) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userId = userData.user.id;

    // Create record based on upload type
    let result;
    
    if (type === "listing") {
      if (!listing_id || !listing_type) {
        return Response.json({ error: "listing_id and listing_type required for listing uploads" }, { status: 400 });
      }

      // Verify user owns the listing
      const table = listing_type === "offer" ? "offers" : "requests";
      const { data: listing, error: listingError } = await supabaseAdmin
        .from(table)
        .select("user_id")
        .eq("id", listing_id)
        .single();

      if (listingError || !listing || listing.user_id !== userId) {
        return Response.json({ error: "Listing not found or access denied" }, { status: 403 });
      }

      // Insert into listing_images table
      const { data, error } = await supabaseAdmin
        .from("listing_images")
        .insert({
          listing_type,
          listing_id,
          user_id: userId,
          storage_path,
          filename,
          file_size,
          mime_type,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create listing image record:", error);
        return Response.json({ error: "Failed to create image record" }, { status: 500 });
      }

      result = data;

    } else if (type === "message") {
      if (!message_id) {
        return Response.json({ error: "message_id required for message uploads" }, { status: 400 });
      }

      // Verify user is part of the conversation
      const { data: message, error: messageError } = await supabaseAdmin
        .from("messages")
        .select("from_user_id, to_user_id")
        .eq("id", message_id)
        .single();

      if (messageError || !message) {
        return Response.json({ error: "Message not found" }, { status: 404 });
      }

      if (message.from_user_id !== userId && message.to_user_id !== userId) {
        return Response.json({ error: "Access denied to this conversation" }, { status: 403 });
      }

      // Insert into message_attachments table
      const { data, error } = await supabaseAdmin
        .from("message_attachments")
        .insert({
          message_id,
          user_id: userId,
          storage_path,
          filename,
          file_size,
          mime_type,
          attachment_type: mime_type.startsWith('image/') ? 'image' : 'document',
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create message attachment record:", error);
        return Response.json({ error: "Failed to create attachment record" }, { status: 500 });
      }

      result = data;

    } else if (type === "delivery") {
      if (!escrow_id) {
        return Response.json({ error: "escrow_id required for delivery uploads" }, { status: 400 });
      }

      // Verify user is the provider for this escrow
      const { data: escrow, error: escrowError } = await supabaseAdmin
        .from("credit_escrow")
        .select("provider_id, status")
        .eq("id", escrow_id)
        .single();

      if (escrowError || !escrow) {
        return Response.json({ error: "Escrow not found" }, { status: 404 });
      }

      if (escrow.provider_id !== userId) {
        return Response.json({ error: "Only the provider can upload delivery files" }, { status: 403 });
      }

      if (escrow.status !== "held") {
        return Response.json({ error: "Cannot upload to this escrow (not in held status)" }, { status: 400 });
      }

      // Insert into delivery_files table
      const { data, error } = await supabaseAdmin
        .from("delivery_files")
        .insert({
          escrow_id,
          provider_id: userId,
          storage_path,
          filename,
          file_size,
          mime_type,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create delivery file record:", error);
        return Response.json({ error: "Failed to create delivery record" }, { status: 500 });
      }

      // Update escrow to mark it has delivery
      await supabaseAdmin
        .from("credit_escrow")
        .update({ 
          has_delivery: true,
          delivered_at: new Date().toISOString()
        })
        .eq("id", escrow_id);

      result = data;

    } else {
      return Response.json({ error: "Invalid upload type" }, { status: 400 });
    }

    return Response.json({ data: result });

  } catch (error) {
    console.error("Upload record creation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}