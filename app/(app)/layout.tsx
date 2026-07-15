import { requireActiveAccess } from "@/lib/requireActiveAccess";

// Route group - "(app)" doesn't appear in the URL, so pages here resolve
// at trade-neutral paths (/jobs, /materials, /schedule, etc.) instead of
// being nested under a business's trade. Every business - electrician,
// plumber, carpenter, whatever - shares this one layout and this one set
// of routes; trade only ever affects which quote builder component
// renders and what data comes back, never the URL itself.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireActiveAccess();
  return <>{children}</>;
}
