"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Paperclip, Upload, X, FileText, Image as ImageIcon, Files } from "lucide-react";

type Attachment = { id: string; file_name: string; storage_path: string; file_type: string | null; file_size: number | null; signedUrl?: string; created_at: string; };
export type { Attachment as AttachmentRow };

type TabId = "all" | "photos" | "certificates";
const TABS: { id: TabId; label: string; icon: typeof Files }[] = [
  { id: "all", label: "All files", icon: Files },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "certificates", label: "Certificates", icon: FileText },
];

function isImage(a: Attachment) { return !!a.file_type?.startsWith("image/"); }
// "Certificates" groups PDFs, since that's what compliance docs, invoices,
// and signed variations get saved as - not an actual join against
// compliance_certs (no shared id exists between the two tables today),
// just a file-type filter on the same attachments list.
function isPdf(a: Attachment) { return a.file_type === "application/pdf"; }

export default function JobFilesPanel({ quoteId, jobId, attachments: initial }: { quoteId: string | null; jobId?: string | null; attachments: Attachment[] }) {
  const [attachments, setAttachments] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");

  const photoCount = useMemo(() => attachments.filter(isImage).length, [attachments]);
  const certCount = useMemo(() => attachments.filter(isPdf).length, [attachments]);
  const visible = useMemo(() => {
    if (tab === "photos") return attachments.filter(isImage);
    if (tab === "certificates") return attachments.filter(isPdf);
    return attachments;
  }, [attachments, tab]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError("Not signed in"); setUploading(false); return; }
    const businessId = await getActiveBusinessId(supabase, userData.user.id);

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${userData.user.id}/${jobId ?? quoteId}/${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("job-files").upload(path, file);
      if (uploadErr) { setError(`Upload failed: ${uploadErr.message}`); continue; }
      const { data: row, error: insertErr } = await supabase.from("job_attachments").insert({
        quote_id: quoteId || null, job_id: jobId ?? null, profile_id: businessId, file_name: file.name, storage_path: path, file_type: file.type, file_size: file.size,
      }).select().single();
      if (!insertErr && row) {
        const { data: signed } = await supabase.storage.from("job-files").createSignedUrl(path, 3600);
        setAttachments((prev) => [...prev, { ...row, signedUrl: signed?.signedUrl }]);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  async function remove(a: Attachment) {
    const supabase = createClient();
    await supabase.storage.from("job-files").remove([a.storage_path]);
    await supabase.from("job_attachments").delete().eq("id", a.id);
    setAttachments((prev) => prev.filter((f) => f.id !== a.id));
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-4 sm:p-5">
      <p className="text-[11px] tracking-[.12em] uppercase text-[var(--amber-deep)] font-bold mb-1">Files</p>
      <p className="font-semibold text-[var(--ink)] mb-3">Drawings, photos and documents</p>

      {error && <p className="text-[13px] text-red-600 mb-2">{error}</p>}

      {attachments.length > 0 && (
        <div className="flex items-center gap-1 mb-3 bg-[var(--app-bg)] rounded-lg p-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = id === "photos" ? photoCount : id === "certificates" ? certCount : attachments.length;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-md py-1.5 px-2 transition-colors ${
                  tab === id ? "bg-[var(--surface)] text-[var(--navy)] shadow-sm" : "text-[var(--ink-faint)]"
                }`}
              >
                <Icon size={12} /> {label}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {attachments.length > 0 && visible.length === 0 && (
        <p className="text-[12.5px] text-[var(--ink-faint)] text-center py-4">Nothing in this tab yet.</p>
      )}

      {visible.length > 0 && (
        <div
          className={tab === "photos"
            ? "grid gap-2 mb-3 grid-cols-[repeat(auto-fill,minmax(100px,1fr))]"
            : "grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3"}
        >
          {visible.map((a) => {
            const image = isImage(a);
            return (
              <div key={a.id} className="relative border border-[var(--line)] rounded-lg overflow-hidden group">
                {image && a.signedUrl ? (
                  <a href={a.signedUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.signedUrl} alt={a.file_name} className="w-full h-24 object-cover" />
                  </a>
                ) : (
                  <a href={a.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-24 bg-[var(--app-bg)]">
                    <FileText size={24} className="text-[var(--ink-faint)] mb-1" />
                    <span className="text-[10px] text-[var(--ink-faint)] text-center px-1 truncate w-full">{a.file_name}</span>
                  </a>
                )}
                <button onClick={() => remove(a)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={11} />
                </button>
                {image && (
                  <p className="text-[10px] text-[var(--ink-faint)] px-1.5 py-1 truncate">{a.file_name}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <label className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--navy)] border-2 border-[var(--line)] rounded-lg px-3 py-2 cursor-pointer">
        {uploading ? <><Upload size={14} className="animate-bounce" />Uploading...</> : <><Paperclip size={14} />Add files</>}
        <input type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={uploading} onChange={handleUpload} />
      </label>
      <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Photos, drawings, PDFs - accessible to you on site via mobile</p>
    </div>
  );
}

