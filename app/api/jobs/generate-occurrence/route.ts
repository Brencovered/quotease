import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateNextOccurrence } from "@/lib/jobs";

export async function POST(request: Request) {
  const { templateId } = await request.json();
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const occurrence = await generateNextOccurrence(supabase, templateId);
  if (!occurrence) {
    return NextResponse.json({ error: "Failed to generate occurrence" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job: occurrence });
}
