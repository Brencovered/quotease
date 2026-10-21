import SeoKeywordsPanel from "@/components/SeoKeywordsPanel";
import AdminSeoRefreshPanel from "@/components/AdminSeoRefreshPanel";

export const metadata = { title: "SEO Keywords - SwiftScope Admin" };

export default function AdminSeoPage() {
  return (
    <div>
      <AdminSeoRefreshPanel />
      <SeoKeywordsPanel />
    </div>
  );
}
