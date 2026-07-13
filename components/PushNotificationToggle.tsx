"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, AlertCircle } from "lucide-react";

// Same VAPID key pair used server-side in lib/push.ts - only the public
// half is exposed to the browser, as intended.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Status = "unsupported" | "not-configured" | "loading" | "off" | "on" | "denied";

export default function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) { setStatus("not-configured"); return; }
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setStatus("denied"); return; }

    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    }).catch(() => setStatus("off"));
  }, []);

  async function enable() {
    setError(null);
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
      });
      const subJson = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");
      setStatus("on");
    } catch {
      setError("Couldn't enable notifications - try again.");
      setStatus("off");
    }
  }

  async function disable() {
    setError(null);
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Couldn't disable notifications - try again.");
      setStatus("on");
    }
  }

  if (status === "not-configured" || status === "unsupported") return null;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-tag">Notifications</p>
          <p className="font-semibold text-[var(--ink)]">Browser push notifications</p>
          <p className="text-[12.5px] text-[var(--ink-faint)] mt-0.5">
            Get notified on this device the moment a quote is accepted or a payment comes in.
          </p>
        </div>
      </div>

      <div className="mt-3">
        {status === "loading" && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-faint)]">
            <Loader2 size={13} className="animate-spin" /> Checking...
          </span>
        )}
        {status === "denied" && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-faint)]">
            <BellOff size={13} /> Blocked in your browser settings - enable notifications for this site to turn this on.
          </span>
        )}
        {status === "off" && (
          <button onClick={enable} className="btn-primary text-[12.5px] py-1.5 px-3 inline-flex items-center gap-1.5" style={{ width: "auto" }}>
            <Bell size={13} /> Enable on this device
          </button>
        )}
        {status === "on" && (
          <button onClick={disable} className="btn-secondary text-[12.5px] py-1.5 px-3 inline-flex items-center gap-1.5">
            <BellOff size={13} /> Turn off on this device
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11.5px] text-[var(--red)] flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
