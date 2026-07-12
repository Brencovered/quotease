"use client";

import { useState } from "react";
import {
  Plug,
  Unplug,
  AlertCircle,
  Check,
  RefreshCw,
  ExternalLink,
  Copy,
  TestTube,
} from "lucide-react";

const ENDPOINTS = [
  { key: "PRODUCT_LISTS", label: "Product Lists", desc: "Cart / product catalogue" },
  { key: "USER_PROFILE", label: "User Profile", desc: "Your maX profile" },
  { key: "USER_CONTEXT", label: "User Context", desc: "Account + permissions" },
  { key: "ORDERS", label: "Orders", desc: "Order history" },
  { key: "ORDER_SUMMARY", label: "Order Summary", desc: "Mini cart summary" },
  { key: "BRANCH_QUOTES", label: "Branch Quotes", desc: "Reece branch quotes" },
  { key: "INVOICES", label: "Invoices", desc: "Invoice list" },
];

export default function ReeceIntegrationPanel() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    message: string;
    details?: unknown;
  } | null>(null);

  const [proxying, setProxying] = useState<string | null>(null);
  const [proxyResult, setProxyResult] = useState<unknown>(null);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/reece/test");
      const data = await res.json();
      setTestResult({
        connected: data.connected,
        message: data.connected
          ? `Connected! Account #${data.account?.accountNumber}`
          : data.error || "Failed",
        details: data,
      });
    } catch (e) {
      setTestResult({
        connected: false,
        message: (e as Error).message,
      });
    } finally {
      setTesting(false);
    }
  }

  async function testEndpoint(key: string) {
    setProxying(key);
    setProxyResult(null);
    try {
      const res = await fetch(`/api/reece/proxy?endpoint=${key}`);
      const data = await res.json();
      setProxyResult(data);
    } catch (e) {
      setProxyResult({ error: (e as Error).message });
    } finally {
      setProxying(null);
    }
  }

  const isConnected = testResult?.connected ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--blue-bg)] border border-blue-200 flex items-center justify-center">
            <Plug size={20} className="text-[var(--blue)]" />
          </div>
          <div>
            <p className="font-display text-[var(--ink)]">Reece maX</p>
            <p className="text-[12px] text-[var(--ink-faint)]">
              Supplier integration — product search, pricing &amp; ordering
            </p>
          </div>
          {testResult && (
            <span
              className={`ml-auto inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-full ${
                isConnected
                  ? "bg-[var(--green-bg)] text-[var(--green)]"
                  : "bg-[var(--red-bg)] text-[var(--red)]"
              }`}
            >
              {isConnected ? <Check size={12} /> : <Unplug size={12} />}
              {isConnected ? "Connected" : "Not connected"}
            </span>
          )}
        </div>
      </div>

      {/* Setup Instructions */}
      {!isConnected && (
        <div className="card space-y-4">
          <p className="section-tag mb-1">Setup</p>
          <p className="font-semibold text-[var(--ink)]">
            Connect your Reece maX account
          </p>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Until Reece registers Swiftscope as a Technology Partner, we use a
            session-based proxy. Follow these steps to connect:
          </p>

          <ol className="space-y-3 text-[13px] text-[var(--ink)]">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] text-[11px] font-bold flex items-center justify-center">
                1
              </span>
              <span>
                Log into{" "}
                <a
                  href="https://www.reece.com.au/max"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--blue)] underline inline-flex items-center gap-0.5"
                >
                  reece.com.au/max <ExternalLink size={11} />
                </a>{" "}
                in Chrome
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] text-[11px] font-bold flex items-center justify-center">
                2
              </span>
              <span>
                Open DevTools → Application → Cookies → www.reece.com.au
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              <span className="space-y-1">
                <p>Copy these values into your Vercel Environment Variables:</p>
                <div className="bg-[var(--app-bg)] rounded-lg p-3 space-y-1.5 font-mono text-[11.5px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink-faint)]">REECE_JWT_TOKEN</span>
                    <span className="text-[var(--ink-soft)] truncate max-w-[200px]">
                      ID.Reece cookie value
                    </span>
                    <CopyButton text="ID.Reece" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink-faint)]">REECE_ACCOUNT_NUMBER</span>
                    <span className="text-[var(--ink-soft)]">
                      reece-account-number cookie
                    </span>
                    <CopyButton text="reece-account-number" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink-faint)]">REECE_USER_ID</span>
                    <span className="text-[var(--ink-soft)]">
                      id from reece-user-profile
                    </span>
                    <CopyButton text="id" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink-faint)]">REECE_COMPANY_ID</span>
                    <span className="text-[var(--ink-soft)]">1101 (default AU)</span>
                    <CopyButton text="1101" />
                  </div>
                </div>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] text-[11px] font-bold flex items-center justify-center">
                4
              </span>
              <span>Click &quot;Test Connection&quot; below</span>
            </li>
          </ol>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-[2px]" />
            <p className="text-[12px] text-amber-700">
              <strong>Note:</strong> Reece JWT tokens expire every ~15 minutes.
              When testing, you may need to refresh the token by visiting
              reece.com.au/max and copying the new cookie value. Once Reece
              registers us as a partner with proper OAuth, this manual step
              goes away.
            </p>
          </div>
        </div>
      )}

      {/* Test Connection */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-tag mb-1">Diagnostics</p>
            <p className="font-semibold text-[var(--ink)]">Test Connection</p>
          </div>
          <button
            onClick={runTest}
            disabled={testing}
            className="btn-primary"
          >
            <TestTube size={14} />
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl px-4 py-3 text-[13px] ${
              testResult.connected
                ? "bg-[var(--green-bg)] text-[var(--green)]"
                : "bg-[var(--red-bg)] text-[var(--red)]"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold mb-1">
              {testResult.connected ? <Check size={14} /> : <AlertCircle size={14} />}
              {testResult.message}
            </div>
            {testResult.details !== undefined && testResult.details !== null && (
              <pre className="text-[11px] opacity-80 overflow-auto max-h-40 mt-2 bg-black/5 rounded-lg p-2">
                {JSON.stringify(testResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Endpoint Explorer */}
      {isConnected && (
        <div className="card space-y-3">
          <p className="section-tag mb-1">Explore</p>
          <p className="font-semibold text-[var(--ink)]">Endpoint Tester</p>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Test individual Reece API endpoints through the proxy:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.key}
                onClick={() => testEndpoint(ep.key)}
                disabled={proxying === ep.key}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--line)] hover:border-[var(--blue)] hover:bg-[var(--blue-bg)] transition text-left"
              >
                <RefreshCw
                  size={14}
                  className={`shrink-0 text-[var(--blue)] ${
                    proxying === ep.key ? "animate-spin" : ""
                  }`}
                />
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--ink)]">
                    {ep.label}
                  </p>
                  <p className="text-[11px] text-[var(--ink-faint)]">{ep.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {proxyResult !== undefined && proxyResult !== null && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-[var(--ink-faint)] mb-1 uppercase tracking-wide">
                Response
              </p>
              <pre className="text-[11px] bg-[var(--app-bg)] rounded-xl p-3 overflow-auto max-h-80 border border-[var(--line)]">
                {JSON.stringify(proxyResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Partner Info */}
      <div className="card space-y-3">
        <p className="section-tag mb-1">Technology Partner</p>
        <p className="font-semibold text-[var(--ink)]">Official Integration</p>
        <p className="text-[13px] text-[var(--ink-soft)]">
          ServiceM8, Fergus, AroFlo and others are registered Reece Technology
          Partners with a standardised OAuth flow. When Reece approves
          Swiftscope, users will click{" "}
          <strong>&quot;Connect to Reece&quot;</strong> and authorise via a popup — no
          manual cookie copying.
        </p>

        <div className="bg-[var(--app-bg)] rounded-xl p-3 space-y-1.5 text-[12.5px] text-[var(--ink-soft)]">
          <p className="font-semibold text-[var(--ink)] text-[13px]">
            Email Reece to apply:
          </p>
          <p>
            To: <strong className="text-[var(--blue)]">maxsupport@reece.com.au</strong>
          </p>
          <p>Subject: Technology Partner Application — SwiftScope</p>
          <p className="text-[11.5px] pt-1">
            Reference: ServiceM8 uses{" "}
            <code className="bg-black/5 px-1 rounded">/link-application/account-select/service-mate/</code>{" "}
            — we need{" "}
            <code className="bg-black/5 px-1 rounded">/link-application/account-select/swiftscope/</code>{" "}
            registered.
          </p>
        </div>

        <a
          href="https://www.reece.com.au/trade/tools-and-services/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary w-full justify-center text-[12px]"
        >
          View Reece Integrations Page <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="text-[var(--ink-faint)] hover:text-[var(--blue)] transition"
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
