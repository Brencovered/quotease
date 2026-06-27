import { NextResponse } from "next/server";

// Requires XERO_CLIENT_ID, XERO_REDIRECT_URI set to this app's
// /api/xero/callback URL, registered at https://developer.xero.com/app/manage.
// This is a per-business app registration - Brendan registers one Xero
// developer app for this product, and every tradie connects their own
// Xero org through it via this OAuth flow.
export async function GET() {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Xero is not configured on this deployment yet. Set XERO_CLIENT_ID and XERO_REDIRECT_URI." },
      { status: 500 }
    );
  }

  const scopes = [
    "openid",
    "profile",
    "email",
    "accounting.transactions",
    "accounting.contacts",
    "offline_access",
  ].join(" ");

  const state = crypto.randomUUID();

  const url = new URL("https://login.xero.com/identity/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("xero_oauth_state", state, { httpOnly: true, maxAge: 600 });
  return response;
}
