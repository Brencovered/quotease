"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessId } from "@/lib/team";
import { Search, User } from "lucide-react";

type Client = { id: string; name: string; email: string | null; billing_address: string | null };

export default function ClientPicker({
  value,
  onChange,
  onSelectClient,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectClient: (client: Client) => void;
}) {
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const businessId = await getActiveBusinessId(supabase, userData.user.id);
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, billing_address")
        .eq("profile_id", businessId)
        .ilike("name", `%${value.trim()}%`)
        .limit(5);
      setResults(data ?? []);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="app-field pl-9"
          placeholder="Jane Smith"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--line)] rounded-lg shadow-lg overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectClient(c);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--app-bg)] flex items-center gap-2.5 border-b border-[var(--line)] last:border-b-0"
            >
              <User size={13} className="text-[var(--ink-faint)] shrink-0" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--ink)] truncate">{c.name}</p>
                {c.billing_address && <p className="text-[11.5px] text-[var(--ink-faint)] truncate">{c.billing_address}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
