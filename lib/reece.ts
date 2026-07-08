// Reece maX integration configuration and helpers
// This proxies requests to Reece's internal API using stored session cookies.
// When Reece approves Swiftscope as a Technology Partner, this gets replaced
// with proper OAuth2 client credentials.

export interface ReeceAccount {
  accountNumber: number;
  permissions: string[];
}

export interface ReeceUserProfile {
  id: number;
  type: string;
  currentAccount: ReeceAccount;
}

// Map of discovered Reece internal API endpoints
export const REECE_ENDPOINTS = {
  // Product catalogue
  PRODUCT_LISTS: "/max/mini-cart/api/product-lists",

  // User data
  USER_PROFILE: "/max/user-profile/api/users/profile",
  USER_CONTEXT: "/max/api/user-context",

  // Account linking (used by ServiceM8, Fergus etc.)
  LINK_APPLICATION: "/link-application/account-select/api",

  // Ordering
  ORDERS: "/max/orders/api/orders",
  ORDER_SUMMARY: "/max/mini-cart/api/summary",

  // Quotes
  BRANCH_QUOTES: "/max/branchquotes/api/quotes",

  // Pricing
  PRICING_DOWNLOAD: "/max/pricing/api/download",

  // Invoicing
  INVOICES: "/max/accounts/api/invoices",
} as const;

// Build the full Reece URL
export function reeceUrl(path: string): string {
  return `https://www.reece.com.au${path}`;
}

// Build the Cookie header from stored credentials
export function buildReeceCookies(config: {
  jwtToken: string;
  accountNumber: string;
  userId: string;
  companyId: string;
}): string {
  const profile: ReeceUserProfile = {
    id: parseInt(config.userId, 10),
    type: "trade",
    currentAccount: {
      accountNumber: parseInt(config.accountNumber, 10),
      permissions: [
        "account_balance",
        "preorder",
        "customer_quote",
        "customer_price",
        "invoice",
        "trade_quote",
        "flexitrak_reports",
      ],
    },
  };

  return [
    `ID.Reece=${config.jwtToken}`,
    `reece-user-profile=${encodeURIComponent(JSON.stringify(profile))}`,
    `reece-account-number=${config.accountNumber}`,
    `reece-origin-companyid=${config.companyId}`,
    `reece-pre-active-account-number_${hashCode(config.accountNumber)}=${config.accountNumber}`,
    "mfa-prompt=false",
  ].join("; ");
}

// Simple hash for the pre-active-account cookie name
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, "0");
}

// Headers needed to proxy a request to Reece's internal API
export function buildReeceHeaders(config: {
  jwtToken: string;
  accountNumber: string;
  userId: string;
  companyId: string;
}): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Referer: "https://www.reece.com.au/max/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    Cookie: buildReeceCookies(config),
  };
}

// Proxy a request to Reece and return the response
export async function proxyToReece(
  endpointPath: string,
  config: {
    jwtToken: string;
    accountNumber: string;
    userId: string;
    companyId: string;
  }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = reeceUrl(endpointPath);
  const headers = buildReeceHeaders(config);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      // @ts-expect-error - next.js fetch option
      cache: "no-store",
    });

    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: (error as Error).message },
    };
  }
}
