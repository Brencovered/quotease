import { NextResponse, type NextRequest } from "next/server";

// Disabled for now — see everything navigable without a working Supabase
// connection while the backend is being set up. Re-enable login gating
// once Supabase env vars are confirmed working in this deployment.
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
