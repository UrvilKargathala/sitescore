"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// ── Client-side format check ──────────────────────────────────────────────────
// Intentionally loose — catches obvious non-URLs before hitting the network.
// The server does thorough validation and SSRF guarding.
function getFormatError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Please enter a URL.";
  if (/\s/.test(trimmed)) return "URLs cannot contain spaces.";

  const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
  if (!withoutScheme || withoutScheme === "/") {
    return "Please enter a domain name, e.g. example.com";
  }

  const host = withoutScheme.split("/")[0].split("?")[0];
  // Must have at least one dot (rules out bare words with no TLD)
  if (!host.includes(".") && !host.startsWith("[")) {
    return "Please enter a full domain name, e.g. example.com";
  }

  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ScanStatus = "queued" | "running" | "ready" | "failed";

type PageState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "polling"; jobId: string; normalized: string; scanStatus: ScanStatus }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 2000;

const STATUS_LABEL: Record<ScanStatus, string> = {
  queued:  "In queue…",
  running: "Scanning…",
  ready:   "Done!",
  failed:  "Scan failed",
};

const STATUS_DETAIL: Record<ScanStatus, string> = {
  queued:  "Your scan is waiting to be picked up by a worker.",
  running: "The worker is processing your URL right now.",
  ready:   "Scan complete.",
  failed:  "Something went wrong during the scan.",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomeClient() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<PageState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatError  = touched ? getFormatError(input) : null;
  const isSubmitting = state.status === "submitting";
  const inlineError  = state.status === "error" ? state.message : formatError ?? null;

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.status !== "polling") return;
    const { jobId, normalized } = state;

    async function poll() {
      try {
        const res = await fetch(`/api/status?jobId=${encodeURIComponent(jobId)}`);
        const data = await res.json();
        const scanStatus: ScanStatus = data.status ?? "queued";

        if (scanStatus === "ready") {
          router.push(`/results/${data.scanId}`);
          return;
        }
        if (scanStatus === "failed") {
          setState({ status: "error", message: data.error ?? "Scan failed unexpectedly." });
          return;
        }

        // Still in progress — update the visible status label and schedule next poll
        setState((prev) =>
          prev.status === "polling"
            ? { ...prev, scanStatus }
            : prev
        );
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        // Transient network error — keep polling
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);

    const clientError = getFormatError(input);
    if (clientError) {
      setState({ status: "error", message: clientError });
      inputRef.current?.focus();
      return;
    }

    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Something went wrong. Please try again." });
        return;
      }

      // Cache hit — server found a recent completed scan, redirect immediately
      if (data.cached) {
        router.push(`/results/${data.scanId}`);
        return;
      }

      setState({
        status: "polling",
        jobId: data.jobId,
        normalized: data.normalized,
        scanStatus: "queued",
      });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Please check your connection." });
    }
  }

  function handleReset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setInput("");
    setTouched(false);
    setState({ status: "idle" });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-2xl text-center">

        {/* Badge */}
        <span
          className="inline-block mb-6 rounded-full px-3 py-1 text-xs font-semibold tracking-widest uppercase"
          style={{ background: "rgba(79,123,255,0.15)", color: "#4F7BFF", fontFamily: "var(--font-manrope)" }}
        >
          Free · No account needed
        </span>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl font-bold leading-tight mb-4 text-white"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          How healthy is your website,{" "}
          <span style={{ color: "#4F7BFF" }}>really?</span>
        </h1>

        <p
          className="text-lg text-gray-400 mb-10 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Paste any URL and get a brutally honest 0–100 health report across
          Performance, SEO, Security, Accessibility, and Mobile — in under 30 seconds.
        </p>

        {/* Form / progress / ready */}
        {state.status !== "polling" ? (
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col">
                <input
                  ref={inputRef}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://yourwebsite.com"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (state.status === "error") setState({ status: "idle" });
                  }}
                  onBlur={() => setTouched(true)}
                  disabled={isSubmitting}
                  aria-label="Website URL"
                  aria-describedby={inlineError ? "url-error" : undefined}
                  aria-invalid={!!inlineError}
                  className={[
                    "w-full rounded-xl px-4 py-3.5 text-sm sm:text-base bg-gray-900",
                    "border text-white placeholder-gray-500 transition-colors",
                    "focus:outline-none focus:ring-2 disabled:opacity-50",
                    inlineError
                      ? "border-red-500 focus:ring-red-500/40"
                      : "border-gray-700 focus:border-[#4F7BFF] focus:ring-[#4F7BFF]/30",
                  ].join(" ")}
                  style={{ fontFamily: "var(--font-manrope)" }}
                />

                {inlineError && (
                  <p
                    id="url-error"
                    role="alert"
                    className="mt-2 text-sm text-red-400 text-left flex items-start gap-1.5"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {inlineError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={[
                  "shrink-0 rounded-xl px-6 py-3.5 font-semibold text-sm sm:text-base text-white",
                  "transition-all focus:outline-none focus:ring-2 focus:ring-[#4F7BFF]/50 focus:ring-offset-2 focus:ring-offset-gray-950",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  isSubmitting ? "cursor-wait" : "hover:brightness-110 active:scale-95",
                ].join(" ")}
                style={{ background: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Checking…
                  </span>
                ) : (
                  "Analyze site"
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ── Progress card ── */
          <ProgressCard
            scanStatus={state.scanStatus}
            normalized={state.normalized}
            jobId={state.jobId}
            onReset={handleReset}
          />
        )}

        {/* Responsible-scanning note */}
        <p
          className="mt-4 text-xs text-gray-600 text-center"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Read-only checks only — no exploitation, no crawling beyond the root page.{" "}
          <a
            href="/scanning-policy"
            className="underline underline-offset-2 hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400"
          >
            Scanning policy
          </a>
        </p>

        {/* Category pills */}
        <div
          className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-gray-600"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {["Performance", "SEO", "Security", "Accessibility", "Mobile"].map((cat) => (
            <span key={cat} className="rounded-full border border-gray-800 px-3 py-1">
              {cat}
            </span>
          ))}
        </div>

      </div>
    </main>
  );
}

// ── Progress card ─────────────────────────────────────────────────────────────
function ProgressCard({
  scanStatus,
  normalized,
  jobId,
  onReset,
}: {
  scanStatus: ScanStatus;
  normalized: string;
  jobId: string;
  onReset: () => void;
}) {
  const steps: ScanStatus[] = ["queued", "running", "ready"];
  const stepIdx = steps.indexOf(scanStatus);

  return (
    <div
      className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-5 text-left"
      role="status"
      aria-live="polite"
      aria-label={STATUS_LABEL[scanStatus]}
    >
      {/* URL + job id */}
      <p className="text-gray-300 text-sm break-all mb-4" style={{ fontFamily: "var(--font-manrope)" }}>
        {normalized}
        <span className="ml-2 text-gray-600 text-xs font-mono">#{jobId}</span>
      </p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-4">
        {steps.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={[
                  "w-2 h-2 rounded-full transition-colors",
                  done    ? "bg-green-400" :
                  active  ? "bg-[#4F7BFF] animate-pulse" :
                            "bg-gray-700",
                ].join(" ")}
              />
              {i < steps.length - 1 && (
                <div className={["h-px w-8 transition-colors", done ? "bg-green-400" : "bg-gray-700"].join(" ")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Label + detail */}
      <p className="font-semibold text-white text-sm" style={{ fontFamily: "var(--font-montserrat)" }}>
        {STATUS_LABEL[scanStatus]}
      </p>
      <p className="text-gray-500 text-xs mt-1" style={{ fontFamily: "var(--font-manrope)" }}>
        {STATUS_DETAIL[scanStatus]}
      </p>

      <button
        onClick={onReset}
        className="mt-4 text-xs text-gray-600 hover:text-gray-400 focus:outline-none transition-colors"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Cancel
      </button>
    </div>
  );
}

