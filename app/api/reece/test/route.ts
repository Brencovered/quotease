import { NextResponse } from "next/server";
import { proxyToReece } from "@/lib/reece";

/**
 * GET /api/reece/test
 *
 * Quick connectivity test to verify Reece proxy is working.
 * Tests the user-context endpoint (lightweight, always available).
 */
export async function GET() {
  const jwtToken = process.env.REECE_JWT_TOKEN;
  const accountNumber = process.env.REECE_ACCOUNT_NUMBER;
  const userId = process.env.REECE_USER_ID;
  const companyId = process.env.REECE_COMPANY_ID || "1101";

  if (!jwtToken || !accountNumber || !userId) {
    return NextResponse.json(
      {
        connected: false,
        error: "Reece credentials not configured",
        missing: [
          !jwtToken && "REECE_JWT_TOKEN",
          !accountNumber && "REECE_ACCOUNT_NUMBER",
          !userId && "REECE_USER_ID",
        ].filter(Boolean),
        setup: {
          step1: "Open Reece maX in Chrome and log in",
          step2: "Open DevTools > Application > Cookies > www.reece.com.au",
          step3: "Copy ID.Reece value → REECE_JWT_TOKEN",
          step4: "Copy reece-account-number → REECE_ACCOUNT_NUMBER",
          step5: "Copy id from reece-user-profile → REECE_USER_ID",
          step6: "Paste these into Vercel Environment Variables",
        },
      },
      { status: 200 }
    );
  }

  // Test with user-context (lightweight endpoint)
  const result = await proxyToReece("/max/api/user-context", {
    jwtToken,
    accountNumber,
    userId,
    companyId,
  });

  if (result.ok) {
    return NextResponse.json({
      connected: true,
      status: result.status,
      account: { accountNumber, userId },
      note: "JWT is valid. You can now test other endpoints via /api/reece/proxy?endpoint=XXX",
    });
  }

  // JWT might be expired
  return NextResponse.json(
    {
      connected: false,
      status: result.status,
      error: "Reece returned an error. Your JWT may be expired.",
      tip: "Reece JWT tokens expire every ~15 minutes. Go to reece.com.au/max to refresh, then copy the new ID.Reece cookie.",
      reeceResponse: result.data,
    },
    { status: 200 }
  );
}
