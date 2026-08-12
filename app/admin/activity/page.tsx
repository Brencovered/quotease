import ActivityFeed from "@/components/admin/ActivityFeed";

export const dynamic = "force-dynamic";

export default function AdminActivityPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-[var(--ink)] mb-1">Activity</h1>
        <p className="text-[13.5px] text-[var(--ink-soft)] max-w-2xl">
          Signups and directory claim attempts, newest first, with a best-effort read on whether each one
          was a known crawler (Googlebot and similar, which announce themselves honestly) or a real
          visitor. Everything unrecognised is labelled human by default, not bot — a wrong &quot;bot&quot;
          label hides something worth seeing, a wrong &quot;human&quot; label just means one extra row to
          glance at.
        </p>
        <p className="text-[12.5px] text-[var(--ink-faint)] mt-2 max-w-2xl">
          This is not the Vercel request log. It reads only your own database events (accounts created,
          listings claimed or created), so it will not show every image request or page prefetch — those
          are real traffic but not things you would call &quot;activity.&quot; IPs that appear more than
          once in the current window are called out separately below the feed; that repeat-IP signal is
          what originally caught 103.78.46.30.
        </p>
      </div>
      <ActivityFeed />
    </div>
  );
}
