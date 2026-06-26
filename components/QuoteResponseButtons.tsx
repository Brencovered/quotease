"use client";

import { useState } from "react";
import { CheckCircle2, Building2, Banknote, CreditCard, X, ArrowLeft } from "lucide-react";
import { type PaymentTerm } from "@/lib/paymentTerms";

type Props = {
  token: string;
  status: string;
  totalCost: number;
  paymentTerms: PaymentTerm[];
  hasBankDetails: boolean;
  bankName?: string | null;
  bankBsb?: string | null;
  bankAccount?: string | null;
  acceptsCash?: boolean;
  businessName?: string;
};

type Step = "idle" | "confirm" | "payment_method" | "bank" | "cash" | "card" | "done_bank" | "done_cash" | "done_card" | "declined";

function termAmount(t: PaymentTerm, total: number) {
  return Math.round((t.percent / 100) * total);
}

export default function QuoteResponseButtons({
  token, status, totalCost, paymentTerms, hasBankDetails,
  bankName, bankBsb, bankAccount, acceptsCash, businessName,
}: Props) {
  const [step,    setStep]    = useState<Step>(status === "accepted" ? "done_bank" : status === "declined" ? "declined" : status === "paid" ? "done_card" : "idle");
  const [loading, setLoading] = useState(false);
  const [agreed,  setAgreed]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Card form state (mock)
  const [cardName,   setCardName]   = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc,    setCardCvc]    = useState("");
  const [cardBusy,   setCardBusy]   = useState(false);

  const firstTerm = paymentTerms[0];
  const depositAmount = firstTerm ? termAmount(firstTerm, totalCost) : totalCost;
  const depositLabel  = paymentTerms.length > 1 ? `${firstTerm?.label ?? "Deposit"} (${firstTerm?.percent}%)` : "Total";

  async function accept() {
    setLoading(true); setError(null);
    const res = await fetch(`/api/q/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep("payment_method");
  }

  async function decline() {
    setLoading(true);
    await fetch(`/api/q/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    setLoading(false);
    setStep("declined");
  }

  async function mockCardPay() {
    if (!cardName || cardNumber.length < 16 || cardExpiry.length < 5 || cardCvc.length < 3) {
      setError("Please fill in all card details");
      return;
    }
    setCardBusy(true); setError(null);
    // Mock delay — replace with real Stripe PaymentIntent call
    await new Promise((r) => setTimeout(r, 1800));
    setCardBusy(false);
    setStep("done_card");
  }

  // ── Idle state — main buttons ────────────────────────────
  if (step === "idle") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setStep("confirm")}
          className="w-full bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[16px] rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[var(--amber-deep)] transition-colors"
        >
          Accept quote & proceed to payment
        </button>
        <button
          onClick={decline}
          disabled={loading}
          className="w-full border-2 border-[var(--line)] text-[var(--ink-soft)] font-semibold rounded-xl py-3 text-[14px] disabled:opacity-50 hover:border-[var(--ink-faint)] transition-colors"
        >
          {loading ? "..." : "Decline"}
        </button>
        {error && <p className="text-[13px] text-red-600 text-center">{error}</p>}
      </div>
    );
  }

  // ── Confirm acceptance ───────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <div className="bg-[var(--app-bg)] rounded-xl p-4 border border-[var(--line)]">
          <p className="font-bold text-[var(--ink)] text-[15px] mb-1">Confirm acceptance</p>
          <p className="text-[13px] text-[var(--ink-soft)] mb-4">
            By accepting, you agree to the scope of works, pricing, and payment terms shown on this quote.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 shrink-0"
              style={{ accentColor: "var(--amber)", width: 18, height: 18 }}
            />
            <span className="text-[13.5px] text-[var(--ink)] leading-snug">
              I accept the quote from <strong>{businessName ?? "the tradie"}</strong> for{" "}
              <strong>${totalCost.toLocaleString()}</strong> and agree to proceed with the payment terms as stated.
            </span>
          </label>
        </div>

        <button
          onClick={accept}
          disabled={!agreed || loading}
          className="w-full bg-[var(--amber)] text-[var(--navy)] font-extrabold text-[15px] rounded-xl py-4 disabled:opacity-40 hover:bg-[var(--amber-deep)] transition-colors"
        >
          {loading ? "Confirming..." : "Confirm & choose payment →"}
        </button>
        <button onClick={() => setStep("idle")} className="w-full text-[13px] text-[var(--ink-faint)] py-1 flex items-center justify-center gap-1">
          <ArrowLeft size={13} /> Back
        </button>
        {error && <p className="text-[13px] text-red-600 text-center">{error}</p>}
      </div>
    );
  }

  // ── Choose payment method ────────────────────────────────
  if (step === "payment_method") {
    const methods = [
      hasBankDetails  && { id: "bank", icon: Building2,  label: "Bank transfer",  sub: `BSB ${bankBsb} · Acc ${bankAccount}` },
      acceptsCash     && { id: "cash", icon: Banknote,   label: "Cash on completion", sub: "Pay when the job is done" },
      { id: "card",   icon: CreditCard, label: "Pay by card",    sub: "Visa, Mastercard — secure payment" },
    ].filter(Boolean) as { id: string; icon: typeof Building2; label: string; sub: string }[];

    return (
      <div className="space-y-3">
        <div className="text-center mb-2">
          <p className="font-bold text-[var(--ink)] text-[15px]">How would you like to pay?</p>
          {paymentTerms.length > 1 && (
            <p className="text-[13px] text-[var(--ink-faint)] mt-0.5">
              {depositLabel}: <strong>${depositAmount.toLocaleString()}</strong> due now
            </p>
          )}
        </div>
        {methods.map((m) => (
          <button key={m.id} onClick={() => setStep(m.id as Step)}
            className="w-full flex items-center gap-4 bg-[var(--surface)] border-2 border-[var(--line)] rounded-xl px-4 py-4 hover:border-[var(--navy)] transition-colors text-left">
            <m.icon size={22} className="text-[var(--navy)] shrink-0" />
            <div>
              <p className="font-bold text-[14px] text-[var(--ink)]">{m.label}</p>
              <p className="text-[12px] text-[var(--ink-faint)]">{m.sub}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // ── Bank transfer instructions ───────────────────────────
  if (step === "bank") {
    return (
      <div className="space-y-4">
        <div className="bg-[var(--green-bg)] border border-green-200 rounded-xl p-4 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-[var(--green)]" />
          <p className="font-bold text-[var(--green)] text-[15px]">Quote accepted!</p>
          <p className="text-[13px] text-green-700 mt-1">Please transfer the deposit to get the job booked in.</p>
        </div>
        <div className="bg-[var(--app-bg)] rounded-xl p-4 space-y-2">
          <p className="text-[11px] font-bold tracking-[.12em] uppercase text-[var(--amber-deep)] mb-2">Bank transfer details</p>
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--ink-soft)]">Account name</span>
            <span className="font-bold text-[var(--ink)]">{bankName ?? businessName ?? "Tradie"}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--ink-soft)]">BSB</span>
            <span className="font-bold text-[var(--ink)] font-mono">{bankBsb}</span>
          </div>
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--ink-soft)]">Account number</span>
            <span className="font-bold text-[var(--ink)] font-mono">{bankAccount}</span>
          </div>
          <div className="flex justify-between text-[14px] border-t border-[var(--line)] pt-2 mt-2">
            <span className="text-[var(--ink-soft)]">{depositLabel}</span>
            <span className="font-display text-[18px] text-[var(--amber-deep)]">${depositAmount.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--ink-faint)] text-center">Use your name as the payment reference. {businessName ?? "The tradie"} will confirm receipt and book the job in.</p>
      </div>
    );
  }

  // ── Cash confirmation ────────────────────────────────────
  if (step === "cash") {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-[var(--green-bg)] border border-green-200 rounded-xl p-5">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-[var(--green)]" />
          <p className="font-bold text-[var(--green)] text-[16px]">Quote accepted — cash on completion</p>
          <p className="text-[13.5px] text-green-700 mt-2">
            Payment of <strong>${totalCost.toLocaleString()}</strong> is due on completion of the job.{" "}
            {businessName ?? "The tradie"} will be in touch to schedule.
          </p>
        </div>
      </div>
    );
  }

  // ── Card payment (mock Stripe UI) ────────────────────────
  if (step === "card") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("payment_method")} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
            <ArrowLeft size={16} />
          </button>
          <p className="font-bold text-[var(--ink)] text-[15px]">Card payment</p>
          <span className="ml-auto text-[11px] text-[var(--ink-faint)] bg-[var(--app-bg)] border border-[var(--line)] rounded px-2 py-0.5 font-semibold">
            🔒 Secure
          </span>
        </div>

        <div className="bg-[var(--amber-light)] border border-[var(--amber)]/30 rounded-xl px-4 py-3 text-center">
          <p className="text-[13px] font-bold text-[var(--amber-deep)]">Amount due today: ${depositAmount.toLocaleString()}</p>
          {paymentTerms.length > 1 && <p className="text-[12px] text-[var(--amber-deep)]/70">{depositLabel}</p>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Name on card</label>
            <input value={cardName} onChange={(e) => setCardName(e.target.value)}
              className="app-field" placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Card number</label>
            <input value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim())}
              className="app-field font-mono tracking-wider" placeholder="1234 5678 9012 3456" maxLength={19} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">Expiry</label>
              <input value={cardExpiry}
                onChange={(e) => { const v = e.target.value.replace(/\D/g,""); setCardExpiry(v.length >= 2 ? v.slice(0,2)+"/"+v.slice(2,4) : v); }}
                className="app-field font-mono" placeholder="MM/YY" maxLength={5} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--ink-soft)] mb-1.5">CVC</label>
              <input value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g,"").slice(0,4))}
                className="app-field font-mono" placeholder="123" maxLength={4} />
            </div>
          </div>
        </div>

        {error && <p className="text-[13px] text-red-600 text-center">{error}</p>}

        <button onClick={mockCardPay} disabled={cardBusy}
          className="w-full bg-[var(--navy)] text-white font-extrabold text-[15px] rounded-xl py-4 disabled:opacity-50">
          {cardBusy ? "Processing payment..." : `Pay $${depositAmount.toLocaleString()} →`}
        </button>

        <p className="text-[11.5px] text-[var(--ink-faint)] text-center flex items-center justify-center gap-1.5">
          <span>🔒</span> Payments processed securely via Stripe. Card details are never stored.
        </p>

        <div className="flex items-center justify-center gap-2 opacity-50">
          {["VISA", "MC", "AMEX"].map((c) => (
            <span key={c} className="border border-[var(--line)] rounded px-2 py-0.5 text-[11px] font-bold text-[var(--ink-faint)]">{c}</span>
          ))}
        </div>
      </div>
    );
  }

  // ── Done: card paid ──────────────────────────────────────
  if (step === "done_card") {
    return (
      <div className="text-center space-y-3 py-2">
        <div className="w-16 h-16 rounded-full bg-[var(--green-bg)] border-2 border-green-200 flex items-center justify-center mx-auto">
          <CheckCircle2 size={32} className="text-[var(--green)]" />
        </div>
        <p className="font-bold text-[var(--ink)] text-[17px]">Payment confirmed!</p>
        <p className="text-[14px] text-[var(--ink-soft)]">
          Your deposit of <strong>${depositAmount.toLocaleString()}</strong> has been received.{" "}
          {businessName ?? "The tradie"} will be in touch to schedule the job.
        </p>
      </div>
    );
  }

  // ── Done: bank / already accepted ───────────────────────
  if (step === "done_bank") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 size={36} className="mx-auto text-green-600 mb-2" />
        <p className="font-bold text-[var(--ink)]">Quote accepted</p>
        <p className="text-[13px] text-[var(--ink-faint)] mt-1">
          {businessName ?? "The tradie"} will be in touch to schedule the job.
        </p>
      </div>
    );
  }

  // ── Done: cash ───────────────────────────────────────────
  if (step === "done_cash") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 size={36} className="mx-auto text-green-600 mb-2" />
        <p className="font-bold text-[var(--ink)]">Quote accepted — cash on completion</p>
      </div>
    );
  }

  // ── Declined ─────────────────────────────────────────────
  if (step === "declined") {
    return (
      <div className="text-center py-4">
        <X size={28} className="mx-auto text-[var(--ink-faint)] mb-2" />
        <p className="font-semibold text-[var(--ink)]">Quote declined</p>
        <p className="text-[13px] text-[var(--ink-faint)] mt-1">No worries — get in touch if anything changes.</p>
      </div>
    );
  }

  return null;
}
