import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { to_user_id, content, listing_id, listing_type } = await request.json();

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
    if (!to_user_id || !content?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: to_user_id and content" },
        { status: 400 }
      );
    }

    // Can't message yourself
    if (from_user_id === to_user_id) {
      return NextResponse.json(
        { error: "Cannot send messages to yourself" },
        { status: 400 }
      );
    }

    // Create message
    const { data: message, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert({
        from_user_id,
        to_user_id,
        content: content.trim(),
        listing_id: listing_id || null,
        listing_type: listing_type || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting message:", insertError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Create notification for message recipient (especially important for admin messages)
    const isAdminMessage = content.trim().startsWith('[ADMIN]');
    if (isAdminMessage) {
      try {
        // Create high-priority notification for admin messages
        await supabaseAdmin.rpc('create_notification', {
          target_user_id: to_user_id,
          notification_type: 'admin_message',
          notification_title: 'New Admin Message',
          notification_message: 'You have received a message from platform administration.',
        });
      } catch (notifError) {
        console.error('Failed to create admin message notification:', notifError);
        // Don't fail the message send if notification fails
      }
    }

    return NextResponse.json({ message }, { status: 200 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
