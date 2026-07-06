import { NextResponse } from "next/server";

// This route has been superseded by /api/schedule/send-weekly
export async function GET() {
  return NextResponse.json(
    { error: "Use /api/schedule/send-weekly instead" },
    { status: 410 }
  );
}
