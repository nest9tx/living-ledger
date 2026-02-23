import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const BUCKET = "delivery-files";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

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

    const userId = userData.user.id;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const escrowId = Number(formData.get("escrowId"));

    if (!file || !escrowId) {
      return Response.json({ error: "file and escrowId are required" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return Response.json({ error: "File exceeds the 50 MB limit" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Verify user is the provider for this escrow
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("provider_id, status")
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (escrow.provider_id !== userId) {
      return Response.json({ error: "Only the provider can upload delivery files" }, { status: 403 });
    }

    if (escrow.status !== "held" && escrow.status !== "delivered") {
      return Response.json(
        { error: "Delivery files can only be uploaded while the order is active" },
        { status: 400 }
      );
    }

    // Build a unique storage path
    const ext = file.name.split(".").pop() || "bin";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${escrowId}/${uniqueName}`;

    // Upload to storage using admin client (bypasses RLS)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      return Response.json({ error: storageError.message || "Upload failed" }, { status: 500 });
    }

    // Record metadata in order_deliverables
    const { data: record, error: insertError } = await supabaseAdmin
      .from("order_deliverables")
      .insert({
        escrow_id: escrowId,
        uploader_id: userId,
        storage_path: storagePath,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up the orphaned storage object
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      console.error("Failed to record deliverable:", insertError);
      return Response.json({ error: "Failed to record upload" }, { status: 500 });
    }

    // Return the record with a fresh signed URL
    const { data: signedData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    return Response.json({
      deliverable: {
        ...record,
        signed_url: signedData?.signedUrl || null,
      },
    });
  } catch (err) {
    console.error("Delivery upload error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
