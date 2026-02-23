import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";

const BUCKET = "delivery-files";

// GET /api/escrow/deliverables?escrowId=X
// Returns all deliverables for an order with 1-hour signed URLs
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const escrowId = Number(searchParams.get("escrowId"));
    if (!escrowId) {
      return Response.json({ error: "escrowId is required" }, { status: 400 });
    }

    const userId = userData.user.id;

    // Verify user is a party to this escrow
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("payer_id, provider_id")
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (escrow.payer_id !== userId && escrow.provider_id !== userId) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch deliverable records
    const { data: records, error: recordsError } = await supabaseAdmin
      .from("order_deliverables")
      .select("id, storage_path, filename, file_size, mime_type, created_at")
      .eq("escrow_id", escrowId)
      .order("created_at", { ascending: true });

    if (recordsError) {
      console.error("Failed to fetch deliverables:", recordsError);
      return Response.json({ error: "Failed to fetch deliverables" }, { status: 500 });
    }

    // Generate 1-hour signed URLs for each file
    const deliverables = await Promise.all(
      (records || []).map(async (record) => {
        const { data: signedData } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(record.storage_path, 3600);

        return {
          ...record,
          signed_url: signedData?.signedUrl || null,
        };
      })
    );

    return Response.json({ deliverables });
  } catch (err) {
    console.error("Deliverables GET error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/escrow/deliverables
// Records metadata for a file the provider uploaded to storage
// Body: { escrowId, storage_path, filename, file_size, mime_type }
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
    const body = await req.json();
    const { escrowId, storage_path, filename, file_size, mime_type } = body;

    if (!escrowId || !storage_path || !filename || !file_size || !mime_type) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
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

    // Record the deliverable
    const { data, error: insertError } = await supabaseAdmin
      .from("order_deliverables")
      .insert({
        escrow_id: escrowId,
        uploader_id: userId,
        storage_path,
        filename,
        file_size,
        mime_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to record deliverable:", insertError);
      return Response.json({ error: "Failed to record deliverable" }, { status: 500 });
    }

    return Response.json({ deliverable: data });
  } catch (err) {
    console.error("Deliverables POST error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
