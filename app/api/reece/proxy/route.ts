import { NextRequest, NextResponse } from "next/server";
import { REECE_ENDPOINTS, proxyToReece } from "@/lib/reece";

// Allowed endpoint keys for proxying
const ALLOWED_KEYS = Object.keys(REECE_ENDPOINTS) as Array<
  keyof typeof REECE_ENDPOINTS
>;

/**
 * GET /api/reece/proxy?endpoint=PRODUCT_LISTS
 *
 * Proxies a request to Reece's internal API using stored session cookies.
 * The cookies are read from environment variables (set via Vercel connector
 * or manual env vars).
 *
 * When Reece approves Swiftscope as a Technology Partner, this flow will be
 * replaced with proper OAuth2 client credentials.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpointKey = searchParams.get("endpoint") as keyof typeof REECE_ENDPOINTS | null;
  const requestToken = searchParams.get("requestToken");

  // Validate endpoint key
  if (!endpointKey || !ALLOWED_KEYS.includes(endpointKey)) {
    return NextResponse.json(
      {
        error: "Invalid or missing endpoint parameter",
        allowed: ALLOWED_KEYS,
      },
      { status: 400 }
    );
  }

  // Read Reece session credentials from environment
  const jwtToken = process.env.REECE_JWT_TOKEN;
  const accountNumber = process.env.REECE_ACCOUNT_NUMBER;
  const userId = process.env.REECE_USER_ID;
  const companyId = process.env.REECE_COMPANY_ID || "1101";

  if (!jwtToken) {
    return NextResponse.json(
      {
        error: "Reece JWT token not configured",
        setup: "Set REECE_JWT_TOKEN in your Vercel environment variables. Get it from DevTools > Application > Cookies > www.reece.com.au > ID.Reece",
      },
      { status: 500 }
    );
  }

  if (!accountNumber || !userId) {
    return NextResponse.json(
      {
        error: "Reece account credentials not configured",
        setup: "Set REECE_ACCOUNT_NUMBER and REECE_USER_ID in Vercel environment variables.",
      },
      { status: 500 }
    );
  }

  // Build the endpoint path
  let endpointPath = REECE_ENDPOINTS[endpointKey];

  // Add query params if present (e.g. requestToken for link-application)
  if (requestToken) {
    const separator = endpointPath.includes("?") ? "&" : "?";
    endpointPath = `${endpointPath}${separator}requestToken=${encodeURIComponent(requestToken)}`;
  }

  // Proxy the request
  const result = await proxyToReece(endpointPath, {
    jwtToken,
    accountNumber,
    userId,
    companyId,
  });

  return NextResponse.json(
    {
      ok: result.ok,
      status: result.status,
      endpoint: endpointKey,
      reeceUrl: `https://www.reece.com.au${endpointPath}`,
      data: result.data,
    },
    { status: result.ok ? 200 : 502 }
  );
}
