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

    const body = await req.json();
    const { accountName, accountNumber, routingNumber, accountType } = body;

    // Validate inputs
    if (!accountName || !accountNumber || !routingNumber || !accountType) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate account number length
    if (accountNumber.length < 4 || accountNumber.length > 17) {
      return NextResponse.json(
        { error: "Account number must be 4-17 digits" },
        { status: 400 }
      );
    }

    // Validate routing number (US: 9 digits)
    if (!/^\d{9}$/.test(routingNumber)) {
      return NextResponse.json(
        { error: "Routing number must be exactly 9 digits" },
        { status: 400 }
      );
    }

    // Store only last 4 digits of account number for security
    const last4 = accountNumber.slice(-4);

    // Update profile with bank account details
    // NOTE: In production, encrypt the routing number and account name
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        bank_account_name: accountName,
        bank_account_last4: last4,
        bank_routing_number: routingNumber, // TODO: Encrypt this in production
        bank_account_type: accountType,
        bank_connected_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save bank account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      last4,
      connectedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Bank account save error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
