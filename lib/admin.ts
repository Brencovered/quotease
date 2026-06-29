/**
 * lib/admin.ts
 * ------------
 * Gatekeeping for the internal /admin dashboard.
 *
 * There's no separate "role" column anywhere -- access is controlled by an
 * email allowlist in the ADMIN_EMAILS env var (comma-separated). Set it in
 * Vercel under Project Settings > Environment Variables, e.g.:
 *
 *   ADMIN_EMAILS=bren.norris360@gmail.com,team@swiftscope.com.au
 *
 * Every /admin route checks this server-side before rendering anything --
 * see app/admin/layout.tsx.
 */

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
