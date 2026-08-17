import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import MarketingNav from "@/components/MarketingNav";
import {
  TOOL_DISCLAIMER,
  sourcesForTool,
  type ToolMeta,
  type ToolSource,
} from "@/lib/marketing/tools";

export function moneyAud(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function ToolShell({
  tool,
  children,
  seoFaqs,
}: {
  tool: ToolMeta;
  children: React.ReactNode;
  seoFaqs?: { q: string; a: string }[];
}) {
  const sources = sourcesForTool(tool.slug);

  return (
    <main className="bg-[#f4f6f8] text-[#071018] min-h-screen">
      <MarketingNav />

      <section className="bg-[#1a242c] border-b border-white/10">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 pt-10 pb-10 lg:pt-12 lg:pb-12">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 font-sans text-[13px] font-semibold text-white/50 hover:text-white transition-colors mb-6"
          >
            All tools
          </Link>
          <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#ffb400] mb-3">
            {tool.audience === "tradie" ? "Free tool for tradies" : "Free tool for homeowners"}
          </p>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] tracking-wide leading-[1.02] text-white max-w-[18ch] mb-4">
            {tool.title}
          </h1>
          <p className="font-sans text-[16px] leading-[1.65] text-[#c5d4e0] max-w-[52ch] mb-5">
            {tool.description}
          </p>
          <p className="font-sans text-[13px] leading-[1.6] text-white/55 max-w-[56ch] border-l-2 border-[#ffb400]/70 pl-4">
            Guideline only. Not financial, tax, or legal advice.
          </p>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 pt-8">
        <ToolDisclaimer />
      </section>

      <section className="max-w-[1280px] mx-auto px-5 sm:px-6 py-8 lg:py-12">{children}</section>

      {seoFaqs?.length ? <ToolSeoBlock title="Common questions" items={seoFaqs} /> : null}

      {sources.length ? <ToolSources sources={sources} /> : null}

      <ToolHook tool={tool} />
    </main>
  );
}

export function ToolDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={[
        "border border-[#e4e8ec] bg-white",
        compact ? "p-4" : "p-5 sm:p-6",
      ].join(" ")}
      role="note"
    >
      <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-2">
        Important
      </p>
      <p className="font-sans text-[14px] leading-[1.65] text-[#3d4a55] max-w-[70ch]">
        {TOOL_DISCLAIMER}
      </p>
    </aside>
  );
}

export function ToolSources({ sources }: { sources: ToolSource[] }) {
  return (
    <section className="max-w-[1280px] mx-auto px-5 sm:px-6 pb-14 lg:pb-16">
      <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] tracking-wide text-[#071018] mb-3">
        Official guides and further reading
      </h2>
      <p className="font-sans text-[14.5px] leading-[1.65] text-[#5a6a78] max-w-[54ch] mb-6">
        Use these sources to check current rates and definitions. Swiftscope does not endorse third-party advice beyond linking the reference.
      </p>
      <ul className="space-y-4 max-w-3xl">
        {sources.map((source) => (
          <li key={source.href} className="border-b border-[#e4e8ec] pb-4">
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 font-sans text-[15px] font-bold text-[#071018] hover:text-[#b88400] transition-colors"
            >
              {source.label}
              <ExternalLink size={14} className="opacity-50 group-hover:opacity-100" aria-hidden />
            </a>
            <p className="font-sans text-[13.5px] leading-[1.6] text-[#5a6a78] mt-1.5 max-w-[54ch]">
              {source.note}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ToolHook({ tool }: { tool: ToolMeta }) {
  return (
    <section className="bg-[#1a242c]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-14 lg:py-16 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        <div className="max-w-[52ch]">
          <p className="font-display text-[clamp(1.5rem,3vw,2.1rem)] tracking-wide leading-[1.1] text-white mb-3">
            {tool.hook}
          </p>
        </div>
        <Link
          href={tool.hookHref}
          className="inline-flex items-center justify-center gap-2 bg-[#ffb400] text-[#1a242c] font-sans font-extrabold text-[15px] px-7 py-4 rounded-lg hover:bg-[#e89e00] transition-colors shrink-0"
        >
          {tool.hookCta} <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function ToolPanel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-[#e4e8ec] p-5 sm:p-7 ${className}`}>
      {title ? (
        <p className="font-sans text-[12px] font-bold tracking-[0.16em] uppercase text-[#b88400] mb-5">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function ToolToggle({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              "px-4 py-2.5 font-sans text-[13.5px] font-bold border transition-colors",
              on
                ? "bg-[#071018] text-white border-[#071018]"
                : "bg-white text-[#071018] border-[#e4e8ec] hover:border-[#071018]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToolSeoBlock({
  title,
  items,
}: {
  title: string;
  items: { q: string; a: string }[];
}) {
  return (
    <section className="max-w-[1280px] mx-auto px-5 sm:px-6 pb-14 lg:pb-16">
      <h2 className="font-display text-[clamp(1.5rem,3vw,2rem)] tracking-wide text-[#071018] mb-6">
        {title}
      </h2>
      <div className="max-w-3xl space-y-0">
        {items.map((item) => (
          <div key={item.q} className="border-b border-[#e4e8ec] py-5 first:pt-0">
            <h3 className="font-display text-[1.1rem] tracking-wide text-[#071018] mb-2">{item.q}</h3>
            <p className="font-sans text-[15px] leading-[1.7] text-[#3d4a55] max-w-[54ch]">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ToolResultRow({
  label,
  value,
  highlight = false,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div className="border-b border-[#e8ecef] pb-4 mb-4 last:mb-0 last:border-0 last:pb-0">
      <div className="flex items-end justify-between gap-4">
        <dt className="font-sans text-[14px] text-[#5a6a78]">{label}</dt>
        <dd
          className={[
            "font-display tracking-wide tabular-nums",
            highlight ? "text-[1.75rem] text-[#b88400]" : "text-[1.35rem] text-[#071018]",
          ].join(" ")}
        >
          {value}
        </dd>
      </div>
      {hint ? <p className="font-sans text-[12.5px] text-[#8b96a1] mt-1.5">{hint}</p> : null}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  display: string;
}) {
  return (
    <label className="block mb-5 last:mb-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-sans text-[14px] font-semibold text-[#071018]">{label}</span>
        <span className="font-sans text-[13.5px] font-bold text-[#b88400] tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#ffb400]"
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block font-sans text-[13.5px] font-semibold text-[#071018] mb-1.5">{label}</span>
      <div className="flex items-center border border-[#d8dee4] bg-[#fafbfc] focus-within:border-[#071018] transition-colors">
        {prefix ? (
          <span className="pl-3 font-sans text-[14px] text-[#8b96a1]">{prefix}</span>
        ) : null}
        <input
          type="number"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent px-3 py-3 font-sans text-[15px] text-[#071018] outline-none tabular-nums"
        />
        {suffix ? (
          <span className="pr-3 font-sans text-[13px] text-[#8b96a1] shrink-0">{suffix}</span>
        ) : null}
      </div>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block font-sans text-[13.5px] font-semibold text-[#071018] mb-1.5">
        {label}
        {required ? <span className="text-[#b88400]"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[#d8dee4] bg-[#fafbfc] px-3 py-3 font-sans text-[15px] text-[#071018] outline-none focus:border-[#071018] transition-colors"
      />
    </label>
  );
}
