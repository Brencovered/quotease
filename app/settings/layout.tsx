import { requireActiveAccess } from "@/lib/requireActiveAccess";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireActiveAccess();
  return <>{children}</>;
}
