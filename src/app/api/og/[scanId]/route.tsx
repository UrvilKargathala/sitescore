/**
 * GET /api/og/[scanId]
 *
 * Generates a 1200×630 Open Graph image for a completed scan result.
 * Uses Next.js ImageResponse (powered by Satori + Resvg).
 * Falls back to a generic branded card if the scan is missing or pending.
 */
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const BRAND = "#4F7BFF";

function gradeColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function gradeLabel(score: number): string {
  if (score >= 90) return "Good";
  if (score >= 50) return "Needs Work";
  return "Critical";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { scanId } = await params;

  const scan = await prisma.scan.findUnique({
    where:  { id: scanId },
    select: { url: true, overallScore: true, status: true },
  }).catch(() => null);

  let hostname   = "your website";
  let score      = 0;
  let isComplete = false;

  if (scan?.status === "COMPLETED" && scan.overallScore != null) {
    isComplete = true;
    score      = scan.overallScore;
    try { hostname = new URL(scan.url).hostname; } catch { hostname = scan.url; }
  }

  const color = isComplete ? gradeColor(score) : BRAND;
  const label = isComplete ? gradeLabel(score) : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        fontFamily: "sans-serif",
        padding: "60px",
      }}
    >
      {/* Brand strip */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "6px",
          background: BRAND,
        }}
      />

      {/* Logo */}
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: BRAND,
          letterSpacing: "0.05em",
          marginBottom: "40px",
        }}
      >
        SITESCORE
      </div>

      {/* Score ring (simple circle) */}
      {isComplete ? (
        <div
          style={{
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            border: `8px solid ${color}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
            background: `rgba(${color === "#22c55e" ? "34,197,94" : color === "#f59e0b" ? "245,158,11" : "239,68,68"},0.07)`,
          }}
        >
          <span style={{ fontSize: "56px", fontWeight: 800, color: "#f9fafb", lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: "16px", color: "#6b7280", marginTop: "4px" }}>/ 100</span>
        </div>
      ) : (
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            border: `6px solid ${BRAND}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
            background: "rgba(79,123,255,0.07)",
          }}
        >
          <span style={{ fontSize: "28px", fontWeight: 700, color: BRAND }}>?</span>
        </div>
      )}

      {/* Hostname */}
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#f9fafb",
          marginBottom: "12px",
          textAlign: "center",
          maxWidth: "900px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {hostname}
      </div>

      {/* Grade badge */}
      {isComplete && (
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color,
            background: `rgba(${color === "#22c55e" ? "34,197,94" : color === "#f59e0b" ? "245,158,11" : "239,68,68"},0.12)`,
            borderRadius: "20px",
            padding: "6px 20px",
            marginBottom: "28px",
          }}
        >
          {label}
        </div>
      )}

      {/* Category pills */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: "36px",
        }}
      >
        {["Performance", "SEO", "Security", "Accessibility", "Mobile"].map((cat) => (
          <div
            key={cat}
            style={{
              fontSize: "13px",
              color: "#6b7280",
              border: "1px solid #1f2937",
              borderRadius: "20px",
              padding: "4px 14px",
            }}
          >
            {cat}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ fontSize: "14px", color: "#374151" }}>
        sitescore.centr8.com · Free website health check
      </div>

      {/* Bottom brand strip */}
      <div
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          height: "4px",
          background: BRAND,
        }}
      />
    </div>,
    { width: 1200, height: 630 }
  );
}
