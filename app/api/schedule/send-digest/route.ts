import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// This route has been superseded by /api/schedule/send-weekly
// Kept as a redirect for backward compatibility
export async function POST() {
  return NextResponse.json(
    { error: "Use /api/schedule/send-weekly instead" },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Use /api/schedule/send-weekly instead" },
    { status: 410 }
  );
}
