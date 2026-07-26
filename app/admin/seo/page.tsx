import SeoKeywordsPanel from "@/components/SeoKeywordsPanel";
import AdminSeoRefreshPanel from "@/components/AdminSeoRefreshPanel";

export const metadata = { title: "SEO Keywords - Swiftscope Admin" };

export default function AdminSeoPage() {
  return (
    <div>
      <AdminSeoRefreshPanel />
      <SeoKeywordsPanel />
    </div>
  );
}
