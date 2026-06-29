import { getTradieRows } from "@/lib/adminData";
import AdminTradiesPanel from "@/components/AdminTradiesPanel";

export const dynamic = "force-dynamic";

export default async function AdminTradiesPage() {
  const rows = await getTradieRows();
  return <AdminTradiesPanel rows={rows} />;
}
