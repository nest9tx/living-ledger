import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_account_id: null,
        stripe_account_status: null,
        stripe_connected_at: null,
        stripe_onboarding_complete: false,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Stripe reset error:", updateError);
      return NextResponse.json(
        { error: "Failed to reset Stripe connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Stripe reset error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset Stripe connection" },
      { status: 500 }
    );
  }
}