"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Mode = "token" | "email";
type Status = "idle" | "submitting" | "done" | "error";

export function DeleteForm({ token }: { token?: string }) {
  const initialMode: Mode = token ? "token" : "email";
  const [email,  setEmail]  = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // If we have a signed token, auto-submit immediately
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  // Auto-submit once if a token is present
  if (token && !autoSubmitted && status === "idle") {
    setAutoSubmitted(true);
    setStatus("submitting");
    fetch("/api/delete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        setMessage(d.message ?? "Done.");
        setStatus("done");
      })
      .catch(() => {
        setMessage("Something went wrong. Please use the email form below.");
        setStatus("error");
      });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");

    try {
      const res  = await fetch("/api/delete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Something went wrong.");
        setStatus("error");
      } else {
        setMessage(data.message);
        setStatus("done");
      }
    } catch {
      setMessage("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-20">
      <div className="w-full max-w-md">

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-8 focus:outline-none focus:text-gray-300"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to SiteScore
        </Link>

        <h1
          className="text-2xl font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Delete My Data
        </h1>
        <p
          className="text-sm text-gray-400 mb-8 leading-relaxed"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Enter the email address you used when requesting your PDF report. We will
          permanently delete all personal data we hold for that address.
          The underlying scan results (scores, not linked to you) may be retained
          for aggregate statistics.
        </p>

        {status === "done" ? (
          <div
            className="rounded-xl border p-6 text-center"
            style={{ borderColor: "rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.07)" }}
          >
            <div className="text-3xl mb-3" aria-hidden="true">✓</div>
            <p
              className="text-white font-semibold mb-2"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              Done
            </p>
            <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-manrope)" }}>
              {message}
            </p>
            <Link
              href="/"
              className="inline-block mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors focus:outline-none focus:text-gray-300"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Return to SiteScore
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label
              htmlFor="del-email"
              className="block text-xs font-semibold text-gray-400 mb-1.5"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              Email address
            </label>
            <input
              id="del-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              disabled={status === "submitting"}
              required
              className={[
                "w-full rounded-xl px-4 py-3 text-sm bg-gray-900 border text-white",
                "placeholder-gray-600 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 mb-4",
                status === "error"
                  ? "border-red-500 focus:ring-red-500/30"
                  : "border-gray-700 focus:border-[#4F7BFF] focus:ring-[#4F7BFF]/30",
              ].join(" ")}
              style={{ fontFamily: "var(--font-manrope)" }}
            />

            {status === "error" && message && (
              <p
                role="alert"
                className="mb-4 text-sm text-red-400"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "submitting" || !email.trim()}
              className={[
                "w-full rounded-xl px-6 py-3 font-semibold text-sm text-white transition-all",
                "focus:outline-none focus:ring-2 focus:ring-red-500/40",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                status === "submitting" ? "cursor-wait" : "hover:brightness-110",
              ].join(" ")}
              style={{ background: "#ef4444", fontFamily: "var(--font-montserrat)" }}
            >
              {status === "submitting" ? "Deleting…" : "Permanently delete my data"}
            </button>

            <p
              className="mt-4 text-xs text-gray-600 text-center"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              This action is irreversible.{" "}
              <Link
                href="/privacy"
                className="underline hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400"
              >
                Privacy policy
              </Link>
            </p>
          </form>
        )}

      </div>
    </main>
  );
}
