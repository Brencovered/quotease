"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FilePlus2, Loader2, Printer, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseSummary, structureToQuoteLines, type StructureSummary } from "@/lib/structurePlans";

type ClientOption = { id: string; name: string | null; billing_address?: string | null };
type QuoteOption = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  site_address: string | null;
  status: string;
  total_cost: number | null;
};

type TemplateOption = { id: string; name: string; plan: unknown };

interface Props {
  id: string;
  businessId: string;
  isTemplate: boolean;
  templates: TemplateOption[];
  priceBook: Array<{ label: string; unit_cost: number }>;
  initialName: string;
  initialClientId: string | null;
  linkedQuoteId: string | null;
  plan: Record<string, unknown> | null;
  lastPrices: Record<string, number> | null;
  clients: ClientOption[];
  openQuotes: QuoteOption[];
  business: { name: string; contact: string; hourlyRate: number; marginPct: number; trade: string; trades: string[] };
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const PLANNER_SRC = "/planner/build-planner.html?embed=1";
const SAVE_DELAY_MS = 1200;
const money = (v: number) => "$" + Math.round(v).toLocaleString("en-AU");

export default function StructureEditor(props: Props) {
  const { id, business } = props;
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const latest = useRef<{ plan: unknown; summary: unknown } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushWaiter = useRef<(() => void) | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);

  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState(props.initialName);
  const [clientId, setClientId] = useState(props.initialClientId ?? "");
  const [quoteId, setQuoteId] = useState(props.linkedQuoteId);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [summary, setSummary] = useState<StructureSummary>({});
  const [busy, setBusy] = useState<null | "quote" | "add">(null);
  const [addOpen, setAddOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const templatesRef = useRef<TemplateOption[]>(props.templates);
  const nameRef = useRef(name);
  nameRef.current = name;

  const client = props.clients.find((c) => c.id === clientId) ?? null;

  const meta = useMemo(
    () => ({
      planName: name,
      clientName: client?.name ?? "",
      siteAddress: client?.billing_address ?? "",
      businessName: business.name,
      businessContact: business.contact,
    }),
    [name, client, business.name, business.contact]
  );

  const post = useCallback((data: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ target: "ss-planner", ...data }, window.location.origin);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const snap = latest.current;
    if (!snap) return true;
    if (savingRef.current) await savingRef.current;
    if (latest.current !== snap && latest.current) return save();
    setSaveState("saving");
    const s = parseSummary(snap.summary);
    const run = (async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("structure_plans")
        .update({
          plan: snap.plan,
          summary: snap.summary,
          materials_total: s.materialsTotal ?? 0,
          labour_hours: s.labourHours ?? 0,
        })
        .eq("id", id);
      if (error) {
        setSaveState("error");
        return false;
      }
      if (latest.current === snap) {
        latest.current = null;
        setSaveState("saved");
      }
      return true;
    })();
    savingRef.current = run;
    const ok = await run;
    savingRef.current = null;
    return ok;
  }, [id]);

  // Asks the planner for its current state, waits for it, then saves.
  const flushAndSave = useCallback(async () => {
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        flushWaiter.current = null;
        resolve();
      }, 1500);
      flushWaiter.current = () => {
        clearTimeout(t);
        flushWaiter.current = null;
        resolve();
      };
      post({ type: "flush" });
    });
    return save();
  }, [post, save]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const d = e.data as { source?: string; type?: string; plan?: unknown; summary?: unknown };
      if (!d || d.source !== "ss-planner") return;
      if (d.type === "ready") {
        post({
          type: "load",
          plan: props.plan,
          prices: props.lastPrices,
          meta,
          settings: { hourlyRate: business.hourlyRate },
          templates: templatesRef.current,
          trades: business.trades,
          pricebook: props.priceBook,
        });
        return;
      }
      if (d.type === "save-template") {
        void saveTemplate(d as { name?: unknown; plan?: unknown; summary?: unknown });
        return;
      }
      if (d.type === "suggest-name") {
        const suggested = typeof (d as { name?: unknown }).name === "string" ? String((d as { name: string }).name).trim() : "";
        const cur = nameRef.current.trim();
        const generic = !cur || cur === "New build" || cur === "Untitled build" || (cur === props.initialName.trim() && / build$/.test(cur));
        if (suggested && generic && !props.isTemplate) {
          setName(suggested);
          void saveDetails({ name: suggested });
        }
        return;
      }
      if (d.type === "change") {
        latest.current = { plan: d.plan, summary: d.summary };
        setSummary(parseSummary(d.summary));
        setSaveState("pending");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
        flushWaiter.current?.();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // meta is sent separately below when it changes; load only needs it once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, save, props.plan, props.lastPrices, business.hourlyRate]);

  useEffect(() => {
    post({ type: "meta", meta });
  }, [meta, post]);

  // Never lose edits on tab close / app switch (phones background tabs hard).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && latest.current) void save();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current) {
        void save();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (latest.current) void save();
    };
  }, [save]);

  async function saveTemplate(d: { name?: unknown; plan?: unknown; summary?: unknown }) {
    const tplName = typeof d.name === "string" ? d.name.trim().slice(0, 80) : "";
    if (!tplName || !d.plan) return;
    const s = parseSummary(d.summary);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("structure_plans")
      .insert({
        profile_id: props.businessId,
        name: tplName,
        plan: d.plan,
        summary: d.summary ?? {},
        materials_total: s.materialsTotal ?? 0,
        labour_hours: s.labourHours ?? 0,
        is_template: true,
      })
      .select("id, name, plan")
      .single();
    if (error || !data) {
      post({ type: "templates", templates: templatesRef.current, message: "Could not save the template. Try again." });
      return;
    }
    templatesRef.current = [...templatesRef.current, { id: data.id, name: data.name, plan: data.plan }].sort((a, b) => a.name.localeCompare(b.name));
    post({ type: "templates", templates: templatesRef.current, message: `Saved "${data.name}". It is now in your templates.` });
  }

  async function saveDetails(patch: { name?: string; client_id?: string | null }) {
    const supabase = createClient();
    const { error } = await supabase.from("structure_plans").update(patch).eq("id", id);
    if (error) setMsg("Could not save that change. Check your connection.");
  }

  async function startQuote() {
    setBusy("quote");
    const ok = await flushAndSave();
    if (!ok) {
      setBusy(null);
      setMsg("Could not save the build, so the quote was not started. Try again.");
      return;
    }
    const qs = new URLSearchParams({ trade: business.trade, structure_id: id });
    if (clientId) qs.set("client_id", clientId);
    router.push(`/quote?${qs.toString()}`);
  }

  async function addToQuote(targetId: string) {
    setBusy("add");
    setAddOpen(false);
    await flushAndSave();
    const supabase = createClient();
    const { data: q, error } = await supabase.from("quotes").select("markup_materials").eq("id", targetId).single();
    if (error) {
      setBusy(null);
      setMsg("Could not open that quote.");
      return;
    }
    const { lines, skipped } = structureToQuoteLines(summary, business.marginPct, business.hourlyRate);
    if (!lines.length) {
      setBusy(null);
      setMsg("Nothing priced yet. Add prices in the Materials tab first.");
      return;
    }
    const current = Array.isArray(q?.markup_materials) ? q.markup_materials : [];
    const { error: upErr } = await supabase
      .from("quotes")
      .update({ markup_materials: [...current, ...lines] })
      .eq("id", targetId);
    if (upErr) {
      setBusy(null);
      setMsg("Could not update that quote.");
      return;
    }
    await supabase.from("structure_plans").update({ quote_id: targetId }).eq("id", id);
    setQuoteId(targetId);
    const total = lines.reduce((s, l) => s + l.totalCost, 0);
    setMsg(
      `Added ${lines.length} lines (${money(total)} incl. ${business.marginPct}% materials margin) to the quote.` +
        (skipped ? ` ${skipped} unpriced ${skipped === 1 ? "line was" : "lines were"} left out.` : "")
    );
    setBusy(null);
  }

  const quotesForPicker = useMemo(() => {
    const list = [...props.openQuotes];
    if (clientId) list.sort((a, b) => Number(b.client_id === clientId) - Number(a.client_id === clientId));
    return list;
  }, [props.openQuotes, clientId]);

  const mat = summary.materialsTotal ?? 0;
  const hrs = summary.labourHours ?? 0;
  const labour = hrs * (summary.labourRate ?? business.hourlyRate);

  return (
    <div className="map-page-wrap flex flex-col h-[calc(100dvh-112px)] sm:h-[100dvh] bg-[var(--paper)]">
      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/structures" aria-label="All builds" className="p-1.5 -ml-1 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]">
          <ArrowLeft size={18} />
        </Link>
        <input
          aria-label="Build name"
          className="font-bold text-[15px] text-[var(--ink)] bg-transparent border-0 border-b border-transparent hover:border-[var(--line)] focus:border-[var(--amber)] focus:outline-none px-0.5 py-1 min-w-0 w-[200px] sm:w-[240px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== props.initialName && saveDetails({ name: name.trim() })}
        />
        {props.isTemplate && <span className="pill bg-[var(--amber-light)] text-[var(--amber-deep)]">Template</span>}
        {!props.isTemplate && (
        <select
          aria-label="Client"
          className="text-[13px] border border-[var(--line)] rounded-lg px-2 py-1.5 bg-[var(--surface)] max-w-[180px]"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            void saveDetails({ client_id: e.target.value || null });
          }}
        >
          <option value="">No client</option>
          {props.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? "Unnamed client"}
            </option>
          ))}
        </select>
        )}
        <span className="text-[12px] text-[var(--ink-faint)] inline-flex items-center gap-1 min-w-[64px]" aria-live="polite">
          {saveState === "saving" && (<><Loader2 size={12} className="animate-spin" /> Saving</>)}
          {saveState === "pending" && "Unsaved"}
          {saveState === "saved" && (<><Check size={12} /> Saved</>)}
          {saveState === "error" && <span className="text-red-600">Not saved</span>}
        </span>

        <div className="hidden md:flex items-center gap-3 text-[12.5px] text-[var(--ink-soft)] ml-auto">
          <span><b className="text-[var(--ink)]">{money(mat)}</b> materials</span>
          <span><b className="text-[var(--ink)]">{Math.round(hrs * 10) / 10} h</b> · {money(labour)} labour</span>
          {(summary.unpriced ?? 0) > 0 && <span className="text-[var(--amber-deep)]">{summary.unpriced} unpriced</span>}
        </div>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <button type="button" onClick={() => post({ type: "print" })} className="btn-secondary !py-1.5 !px-3 !text-[13px]" title="Print plans and build guide">
            <Printer size={14} /> <span className="hidden sm:inline">Plans</span>
          </button>
          {!props.isTemplate && (<>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              disabled={busy !== null || props.openQuotes.length === 0}
              className="btn-secondary !py-1.5 !px-3 !text-[13px]"
              title={props.openQuotes.length ? "Add this build to an open quote" : "No open quotes"}
            >
              {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
              <span className="hidden sm:inline">Add to quote</span>
            </button>
            {addOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-[290px] max-h-[320px] overflow-auto bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg py-1">
                {quotesForPicker.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => addToQuote(q.id)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--paper)]"
                  >
                    <span className="block text-[13px] font-semibold text-[var(--ink)]">
                      {q.client_name ?? "No client"} {q.id === quoteId && <span className="text-[var(--amber-deep)]">· linked</span>}
                    </span>
                    <span className="block text-[11.5px] text-[var(--ink-faint)] capitalize">
                      {q.status} · {q.site_address ?? "No address"} · {money(Number(q.total_cost) || 0)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={startQuote}
            disabled={busy !== null}
            className="btn-primary !w-auto !py-1.5 !px-3.5 !text-[13px]"
          >
            {busy === "quote" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Start quote
          </button>
          </>)}
        </div>
      </div>

      {msg && (
        <div className="shrink-0 bg-[var(--amber-light)] text-[var(--ink)] text-[13px] px-4 py-2 flex items-center justify-between gap-3">
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg(null)} className="text-[12px] font-bold">Dismiss</button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {mounted && (
          <iframe
            ref={frameRef}
            src={PLANNER_SRC}
            title="Build planner"
            allow="microphone"
            className="w-full h-full border-0 block"
          />
        )}
      </div>
    </div>
  );
}
