import { requireActiveAccess } from "@/lib/requireActiveAccess";

export default async function ElectricianLayout({ children }: { children: React.ReactNode }) {
  await requireActiveAccess();
  return <>{children}</>;
}
