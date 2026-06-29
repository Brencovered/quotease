import { notFound } from "next/navigation";
import { getTradieDetail } from "@/lib/adminData";
import AdminTradieDetailPanel from "@/components/AdminTradieDetailPanel";

export const dynamic = "force-dynamic";

export default async function AdminTradieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTradieDetail(id);
  if (!detail) notFound();

  return <AdminTradieDetailPanel detail={detail} />;
}
