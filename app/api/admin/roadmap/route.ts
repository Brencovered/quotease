import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

const STATUSES = ["idea", "scoped", "roadmap", "in_progress", "in_branch", "live"] as const;
const CATEGORIES = ["feature", "bug", "infra"] as const;

// roadmap_items has RLS enabled with no policies (admin-only, service-role-only
// table — see migration). The session client below is used purely to identify
// the caller via isAdminEmail(); all actual reads/writes use the admin client.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isAdminEmail(userData.user.email)) {
    return { ok: false as const };
  }
  return { ok: true as const, supabase: createAdminClient() };
}

/* ------------------------------------------------------------------ */
/*  POST – create a new roadmap item                                   */
/* ------------------------------------------------------------------ */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, description, category, status, prd_content, branch_name, priority_order, notes } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const payload = {
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : null,
    category: CATEGORIES.includes(category as typeof CATEGORIES[number]) ? category : "feature",
    status: STATUSES.includes(status as typeof STATUSES[number]) ? status : "idea",
    prd_content: typeof prd_content === "string" ? prd_content : null,
    branch_name: typeof branch_name === "string" && branch_name.trim() ? branch_name.trim() : null,
    priority_order: typeof priority_order === "number" ? priority_order : 0,
    notes: typeof notes === "string" ? notes : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase.from("roadmap_items").insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

/* ------------------------------------------------------------------ */
/*  PUT – update an existing roadmap item                              */
/* ------------------------------------------------------------------ */
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = body.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  const { title, description, category, status, prd_content, branch_name, priority_order, notes } = body;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    payload.title = title.trim();
  }
  if (description !== undefined) payload.description = typeof description === "string" ? description.trim() : null;
  if (category !== undefined) payload.category = CATEGORIES.includes(category as typeof CATEGORIES[number]) ? category : "feature";
  if (status !== undefined) {
    payload.status = STATUSES.includes(status as typeof STATUSES[number]) ? status : "idea";
    // Auto-stamp shipped_at when an item moves to "live"; clear it if moved back.
    if (status === "live") {
      payload.shipped_at = new Date().toISOString();
    } else {
      payload.shipped_at = null;
    }
  }
  if (prd_content !== undefined) payload.prd_content = typeof prd_content === "string" ? prd_content : null;
  if (branch_name !== undefined) payload.branch_name = typeof branch_name === "string" && branch_name.trim() ? branch_name.trim() : null;
  if (priority_order !== undefined) payload.priority_order = typeof priority_order === "number" ? priority_order : 0;
  if (notes !== undefined) payload.notes = typeof notes === "string" ? notes : null;

  const { data, error } = await auth.supabase.from("roadmap_items").update(payload).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

/* ------------------------------------------------------------------ */
/*  DELETE – delete a roadmap item                                     */
/* ------------------------------------------------------------------ */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("roadmap_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
