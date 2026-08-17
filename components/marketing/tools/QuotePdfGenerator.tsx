"use client";

import { useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import {
  moneyAud,
  NumberField,
  TextField,
  ToolPanel,
} from "@/components/marketing/tools/ToolShell";

type Line = { id: string; description: string; qty: number; unitPrice: number };

function newLine(): Line {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    qty: 1,
    unitPrice: 0,
  };
}

export default function QuotePdfGenerator() {
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [abn, setAbn] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { id: "1", description: "Labour", qty: 4, unitPrice: 110 },
    { id: "2", description: "Materials", qty: 1, unitPrice: 240 },
  ]);
  const [logoBytes, setLogoBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + Math.max(l.qty, 0) * Math.max(l.unitPrice, 0), 0),
    [lines]
  );

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function onLogo(file: File | null) {
    if (!file) {
      setLogoBytes(null);
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    setLogoBytes(buf);
  }

  async function downloadPdf() {
    setError(null);
    if (!businessName.trim() || !email.trim() || !clientName.trim()) {
      setError("Business name, your email, and client name are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email so we can send your PDF tips later.");
      return;
    }
    if (lines.every((l) => !l.description.trim())) {
      setError("Add at least one line item.");
      return;
    }

    setBusy(true);
    try {
      await fetch("/api/tools/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          tool: "quote-pdf",
          businessName: businessName.trim(),
          phone: phone.trim() || undefined,
        }),
      }).catch(() => null);

      const bytes = await buildPdf({
        businessName: businessName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        abn: abn.trim(),
        clientName: clientName.trim(),
        siteAddress: siteAddress.trim(),
        jobTitle: jobTitle.trim() || "Quote",
        lines,
        logoBytes,
      });

      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${businessName.trim().replace(/\s+/g, "-").toLowerCase()}-quote.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not build the PDF. Try again without a logo, or use a PNG/JPG logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 space-y-6">
        <ToolPanel title="Your business">
          <div className="grid sm:grid-cols-2 gap-x-5">
            <TextField label="Business name" value={businessName} onChange={setBusinessName} required placeholder="Acme Electrical" />
            <TextField label="Your email" value={email} onChange={setEmail} type="email" required placeholder="you@business.com.au" />
            <TextField label="Phone" value={phone} onChange={setPhone} placeholder="04xx xxx xxx" />
            <TextField label="ABN" value={abn} onChange={setAbn} placeholder="12 345 678 901" />
          </div>
          <label className="block mt-2">
            <span className="block font-sans text-[13.5px] font-semibold text-[#071018] mb-1.5">Logo (optional PNG/JPG)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
              className="block w-full font-sans text-[13.5px] text-[#5a6a78]"
            />
          </label>
        </ToolPanel>

        <ToolPanel title="Client and job">
          <div className="grid sm:grid-cols-2 gap-x-5">
            <TextField label="Client name" value={clientName} onChange={setClientName} required placeholder="Rory Broad" />
            <TextField label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="Kitchen lighting upgrade" />
          </div>
          <TextField label="Site address" value={siteAddress} onChange={setSiteAddress} placeholder="8 Century Ave, Seaford VIC" />
        </ToolPanel>

        <ToolPanel title="Line items">
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line.id} className="grid sm:grid-cols-12 gap-3 items-end border-b border-[#eef0f3] pb-4">
                <div className="sm:col-span-6">
                  <TextField
                    label="Description"
                    value={line.description}
                    onChange={(v) => updateLine(line.id, { description: v })}
                    placeholder="Downlights supply and install"
                  />
                </div>
                <div className="sm:col-span-2">
                  <NumberField
                    label="Qty"
                    value={line.qty}
                    onChange={(n) => updateLine(line.id, { qty: n })}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div className="sm:col-span-3">
                  <NumberField
                    label="Unit $"
                    value={line.unitPrice}
                    onChange={(n) => updateLine(line.id, { unitPrice: n })}
                    prefix="$"
                    min={0}
                    step={1}
                  />
                </div>
                <div className="sm:col-span-1 pb-3">
                  <button
                    type="button"
                    aria-label="Remove line"
                    onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== line.id) : prev))}
                    className="text-[#8b96a1] hover:text-[#071018] p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="inline-flex items-center gap-2 font-sans text-[14px] font-bold text-[#071018] hover:text-[#b88400] mt-2"
          >
            <Plus size={15} aria-hidden /> Add line
          </button>
        </ToolPanel>
      </div>

      <div className="lg:col-span-5 lg:sticky lg:top-6">
        <ToolPanel title="Download">
          <p className="font-sans text-[13.5px] text-[#5a6a78] mb-4">
            Total
          </p>
          <p className="font-display text-[2.4rem] tracking-wide text-[#b88400] mb-6">
            {moneyAud(total, 2)}
          </p>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78] mb-5">
            We use your email to follow up with quoting tips. No spam. The PDF downloads straight to your device.
          </p>
          {error ? (
            <p className="font-sans text-[13.5px] text-[#b42318] mb-4">{error}</p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={downloadPdf}
            className="inline-flex w-full items-center justify-center gap-2 bg-[#ffb400] text-[#1a242c] font-sans font-extrabold text-[15px] px-5 py-3.5 rounded-lg hover:bg-[#e89e00] transition-colors disabled:opacity-60"
          >
            {busy ? "Building PDF…" : "Download quote PDF"} <ArrowRight size={15} aria-hidden />
          </button>
        </ToolPanel>
      </div>
    </div>
  );
}

async function buildPdf(input: {
  businessName: string;
  email: string;
  phone: string;
  abn: string;
  clientName: string;
  siteAddress: string;
  jobTitle: string;
  lines: Line[];
  logoBytes: Uint8Array | null;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.1, 0.14, 0.17);
  const amber = rgb(1, 0.706, 0);
  const soft = rgb(0.35, 0.4, 0.45);
  const line = rgb(0.89, 0.9, 0.92);

  let y = 790;

  if (input.logoBytes) {
    try {
      const img =
        input.logoBytes[0] === 0x89
          ? await pdf.embedPng(input.logoBytes)
          : await pdf.embedJpg(input.logoBytes);
      const scale = Math.min(120 / img.width, 48 / img.height);
      page.drawImage(img, {
        x: 48,
        y: y - img.height * scale + 12,
        width: img.width * scale,
        height: img.height * scale,
      });
    } catch {
      // Logo optional — continue without it
    }
  }

  page.drawText("QUOTE", {
    x: 420,
    y: y,
    size: 22,
    font: bold,
    color: amber,
  });
  y -= 36;

  page.drawText(input.businessName, { x: 48, y, size: 16, font: bold, color: navy });
  y -= 18;
  page.drawText(input.email, { x: 48, y, size: 10, font, color: soft });
  y -= 14;
  if (input.phone) {
    page.drawText(input.phone, { x: 48, y, size: 10, font, color: soft });
    y -= 14;
  }
  if (input.abn) {
    page.drawText(`ABN ${input.abn}`, { x: 48, y, size: 10, font, color: soft });
    y -= 14;
  }

  y -= 16;
  page.drawRectangle({ x: 48, y: y + 8, width: 499, height: 1, color: line });
  y -= 10;

  page.drawText(`Prepared for: ${input.clientName}`, { x: 48, y, size: 11, font: bold, color: navy });
  y -= 16;
  if (input.siteAddress) {
    page.drawText(`Site: ${input.siteAddress}`, { x: 48, y, size: 10, font, color: soft });
    y -= 16;
  }
  page.drawText(input.jobTitle, { x: 48, y, size: 13, font: bold, color: navy });
  y -= 28;

  page.drawText("Description", { x: 48, y, size: 9, font: bold, color: soft });
  page.drawText("Qty", { x: 340, y, size: 9, font: bold, color: soft });
  page.drawText("Unit", { x: 400, y, size: 9, font: bold, color: soft });
  page.drawText("Total", { x: 480, y, size: 9, font: bold, color: soft });
  y -= 8;
  page.drawRectangle({ x: 48, y, width: 499, height: 1, color: line });
  y -= 18;

  let grand = 0;
  for (const item of input.lines) {
    if (!item.description.trim()) continue;
    const rowTotal = Math.max(item.qty, 0) * Math.max(item.unitPrice, 0);
    grand += rowTotal;
    const desc = item.description.slice(0, 48);
    page.drawText(desc, { x: 48, y, size: 10, font, color: navy });
    page.drawText(String(item.qty), { x: 340, y, size: 10, font, color: navy });
    page.drawText(`$${item.unitPrice.toFixed(2)}`, { x: 400, y, size: 10, font, color: navy });
    page.drawText(`$${rowTotal.toFixed(2)}`, { x: 470, y, size: 10, font: bold, color: navy });
    y -= 18;
    if (y < 100) break;
  }

  y -= 10;
  page.drawRectangle({ x: 48, y, width: 499, height: 1, color: line });
  y -= 24;
  page.drawText("Total", { x: 400, y, size: 12, font: bold, color: navy });
  page.drawText(`$${grand.toFixed(2)}`, { x: 460, y, size: 14, font: bold, color: navy });

  y = 70;
  page.drawText("Created free with Swiftscope tools. Quote on site in seconds at swiftscope.com.au", {
    x: 48,
    y,
    size: 8,
    font,
    color: soft,
  });

  return pdf.save();
}
