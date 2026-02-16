import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
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

    const userId = userData.user.id;

    // Get query params
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get("other_user_id");
    const listingId = searchParams.get("listing_id");
    const listingType = searchParams.get("listing_type");

    let query = supabaseAdmin
      .from("messages")
      .select(`
        *,
        from_profile:from_user_id (id, email, username),
        to_profile:to_user_id (id, email, username)
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    // Filter by conversation partner
    if (otherUserId) {
      query = query.or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
      );
    }

    // Filter by listing
    if (listingId && listingType) {
      query = query.eq("listing_id", listingId).eq("listing_type", listingType);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] }, { status: 200 });
  } catch (error) {
    console.error("List messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
