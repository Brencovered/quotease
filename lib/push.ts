import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends a browser push notification to every device subscribed for a
 * business (owner + any active team members who've enabled push on
 * their own device - see push_subscriptions RLS). Best-effort: a missing
 * VAPID config or a failed send never throws back to the caller, since
 * a notification failing shouldn't block the real action (accepting a
 * quote, recording a payment, etc.) that triggered it.
 *
 * Expired/invalid subscriptions (410 Gone, 404) are cleaned up as they're
 * discovered, so the subscription list doesn't just grow stale forever.
 */
export async function sendPushToBusiness(admin: SupabaseClient, businessId: string, payload: PushPayload): Promise<void> {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    // Not configured yet - silently skip rather than error. Push is an
    // enhancement, not a hard dependency of the actions that call this.
    return;
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("business_id", businessId);

  if (!subs?.length) return;

  const webpush = await import("web-push");
  webpush.setVapidDetails("mailto:support@swiftscope.com.au", publicKey, privateKey);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription no longer valid (browser data cleared, uninstalled, etc.)
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] send failed for subscription", sub.id, err);
        }
      }
    })
  );
}
