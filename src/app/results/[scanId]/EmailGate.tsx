"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

type Status = "idle" | "submitting" | "sent" | "error";

export function EmailGate({
  scanId,
  alreadySubmitted,
}: {
  scanId: string;
  alreadySubmitted: boolean;
}) {
  const [email,    setEmail]    = useState("");
  const [consent,  setConsent]  = useState(false);
  const [touched,  setTouched]  = useState(false);
  const [status,   setStatus]   = useState<Status>(alreadySubmitted ? "sent" : "idle");
  const [apiError, setApiError] = useState<string | null>(null);

  const emailError  = touched && !isValidEmail(email) ? "Please enter a valid email address." : null;
  const consentError = touched && !consent ? "Please check the consent box to receive your report." : null;
  const isDisabled  = status === "submitting" || status === "sent";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValidEmail(email) || !consent) return;

    setStatus("submitting");
    setApiError(null);

    try {
      const res  = await fetch("/api/report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scanId, email: email.trim().toLowerCase(), consent }),
      });
      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setApiError("Could not reach the server. Please check your connection.");
      setStatus("error");
    }
  }

  // ── Sent state ────────────────────────────────────────────────────────────

  if (status === "sent") {
    return (
      <section
        aria-labelledby="gate-sent-heading"
        className="rounded-xl border p-6 text-center"
        style={{
          borderColor: "rgba(34,197,94,0.25)",
          background:  "rgba(34,197,94,0.07)",
        }}
      >
        <div className="text-3xl mb-3" aria-hidden="true">📬</div>
        <h2
          id="gate-sent-heading"
          className="text-lg font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Report on its way!
        </h2>
        <p
          className="text-sm text-gray-400 max-w-sm mx-auto"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Check your inbox — your full branded PDF report will arrive shortly.
          If you don&apos;t see it within a few minutes, check your spam folder.
        </p>
        <p
          className="text-xs text-gray-600 mt-4"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Need help? <a
            href="https://centr8.com/contact"
            className="hover:underline focus:outline-none focus:underline"
            style={{ color: "#4F7BFF" }}
          >Book a free consultation</a> with our team.
        </p>
      </section>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <section
      aria-labelledby="gate-heading"
      className="rounded-xl border px-6 py-7"
      style={{ borderColor: "rgba(79,123,255,0.2)", background: "rgba(79,123,255,0.05)" }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl shrink-0" aria-hidden="true">📄</span>
        <div>
          <h2
            id="gate-heading"
            className="text-lg font-bold text-white"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Get Your Full Branded PDF Report
          </h2>
          <p
            className="text-sm text-gray-400 mt-1"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Receive a richer, print-ready report with extended findings, specific
            action steps, and a fix roadmap — free, no account required.
          </p>
        </div>
      </div>

      {/* What's included */}
      <ul
        className="text-xs text-gray-500 flex flex-col gap-1 mb-6 ml-1"
        style={{ fontFamily: "var(--font-manrope)" }}
        aria-label="Report contents"
      >
        {[
          "All five category scores with business-impact analysis",
          "Full prioritised fix list with specific action steps per issue",
          "Methodology appendix and scoring explanation",
          "Consultation CTA + upcoming continuous monitoring details",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span style={{ color: "#4F7BFF" }} aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} noValidate aria-label="Request PDF report">
        {/* Email field */}
        <div className="mb-4">
          <label
            htmlFor="report-email"
            className="block text-xs font-semibold text-gray-400 mb-1.5"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Email address
          </label>
          <input
            id="report-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") { setStatus("idle"); setApiError(null); }
            }}
            onBlur={() => setTouched(true)}
            disabled={isDisabled}
            aria-required="true"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm bg-gray-900 border text-white",
              "placeholder-gray-600 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50",
              emailError
                ? "border-red-500 focus:ring-red-500/30"
                : "border-gray-700 focus:border-[#4F7BFF] focus:ring-[#4F7BFF]/30",
            ].join(" ")}
            style={{ fontFamily: "var(--font-manrope)" }}
          />
          {emailError && (
            <p
              id="email-error"
              role="alert"
              className="mt-1.5 text-xs text-red-400"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {emailError}
            </p>
          )}
        </div>

        {/* Consent checkbox — not pre-checked, required */}
        <div className="mb-5">
          <label
            className="flex items-start gap-3 cursor-pointer group"
            htmlFor="report-consent"
          >
            <input
              id="report-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={isDisabled}
              aria-required="true"
              aria-invalid={!!consentError}
              aria-describedby={consentError ? "consent-error" : undefined}
              className="mt-0.5 w-4 h-4 rounded accent-[#4F7BFF] cursor-pointer shrink-0"
            />
            <span
              className="text-xs text-gray-400 leading-relaxed"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              I agree to receive my SiteScore report and occasional relevant
              follow-up from Centr8. You can unsubscribe at any time.{" "}
              Data is deleted after 12 months.{" "}
              <Link href="/privacy" className="underline hover:text-gray-300 transition-colors">
                Privacy policy
              </Link>
            </span>
          </label>
          {consentError && (
            <p
              id="consent-error"
              role="alert"
              className="mt-1.5 ml-7 text-xs text-red-400"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {consentError}
            </p>
          )}
        </div>

        {/* API-level error */}
        {apiError && (
          <div
            role="alert"
            className="mb-4 rounded-lg px-4 py-3 text-sm text-red-400 border border-red-500/30 bg-red-500/05"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {apiError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isDisabled}
          className={[
            "w-full rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-all",
            "focus:outline-none focus:ring-2 focus:ring-[#4F7BFF]/50 focus:ring-offset-2 focus:ring-offset-gray-950",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            status === "submitting" ? "cursor-wait" : "hover:brightness-110 active:scale-[0.99]",
          ].join(" ")}
          style={{ background: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
        >
          {status === "submitting" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Sending…
            </span>
          ) : (
            "Get My Free PDF Report"
          )}
        </button>
      </form>
    </section>
  );
}
