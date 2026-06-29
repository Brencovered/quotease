import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const XERO_CLIENT_ID     = process.env.XERO_CLIENT_ID!;
const XERO_REDIRECT_URI  = process.env.NEXT_PUBLIC_APP_URL + "/api/xero/callback";
const XERO_SCOPES        = "openid profile email accounting.transactions accounting.contacts offline_access";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  const state  = Buffer.from(user.id).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     XERO_CLIENT_ID,
    redirect_uri:  XERO_REDIRECT_URI,
    scope:         XERO_SCOPES,
    state,
  });

  return NextResponse.redirect(`https://login.xero.com/identity/connect/authorize?${params}`);
}
