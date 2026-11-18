/**
 * Email domains in public.email_domain_blocklist are refused at signup by
 * a trigger on auth.users. Supabase does not pass that reason back
 * cleanly (email signups have shown "Unable to validate email address:
 * invalid format", OAuth signups come back as "Database error saving new
 * user"), so the forms check first and show this message instead.
 */
export const BLOCKED_EMAIL_MESSAGE =
  "Unsecure email address. Please reach out to team@swiftscope.com.au to assess acceptability.";

/** Query value the auth callback adds when an OAuth signup was refused. */
export const BLOCKED_EMAIL_PARAM = "blocked_email";

const PLAIN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the server says this email's domain is blocked. Fails open. */
export async function isBlockedEmail(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/account/email-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const d = (await res.json()) as { blocked?: boolean };
    return d.blocked === true;
  } catch {
    return false;
  }
}

/**
 * Turn a Supabase signup error into what the person should see. A
 * well-formed address that Supabase still calls invalid, or a database
 * error on signup, is the domain block.
 */
export function signupErrorMessage(message: string, email: string): string {
  const wellFormed = PLAIN_EMAIL.test(email.trim());
  if (/database error saving new user|not available for this email/i.test(message)) return BLOCKED_EMAIL_MESSAGE;
  if (wellFormed && /unable to validate email address/i.test(message)) return BLOCKED_EMAIL_MESSAGE;
  return message;
}
