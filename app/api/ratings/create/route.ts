import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { escrow_id, to_user_id, score, comment } = await request.json();

    // Get authenticated user
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const from_user_id = userData.user.id;

    // Validate required fields
    if (!escrow_id || !to_user_id || !score) {
      return NextResponse.json(
        { error: "Missing required fields: escrow_id, to_user_id, score" },
        { status: 400 }
      );
    }

    if (score < 1 || score > 5) {
      return NextResponse.json(
        { error: "Score must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Verify escrow exists and is completed
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("credit_escrow")
      .select("*")
      .eq("id", escrow_id)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json(
        { error: "Escrow not found" },
        { status: 404 }
      );
    }

    // Verify user is part of this transaction
    if (escrow.buyer_id !== from_user_id && escrow.provider_id !== from_user_id) {
      return NextResponse.json(
        { error: "You are not part of this transaction" },
        { status: 403 }
      );
    }

    // Verify escrow is released (completed)
    if (escrow.status !== "released") {
      return NextResponse.json(
        { error: "Can only rate completed transactions" },
        { status: 400 }
      );
    }

    // Check if rating already exists
    const { data: existingRating } = await supabaseAdmin
      .from("ratings")
      .select("id")
      .eq("escrow_id", escrow_id)
      .eq("from_user_id", from_user_id)
      .single();

    if (existingRating) {
      return NextResponse.json(
        { error: "You have already rated this transaction" },
        { status: 400 }
      );
    }

    // Create rating
    const { data: rating, error: insertError } = await supabaseAdmin
      .from("ratings")
      .insert({
        escrow_id,
        from_user_id,
        to_user_id,
        score,
        comment: comment?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting rating:", insertError);
      return NextResponse.json(
        { error: "Failed to submit rating" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rating }, { status: 200 });
  } catch (error) {
    console.error("Create rating error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
