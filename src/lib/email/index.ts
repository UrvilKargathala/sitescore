/**
 * Resend email wrapper.
 * All outbound email goes through this module so delivery logic is centralised.
 */
import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

const FROM   = process.env.RESEND_FROM ?? "SiteScore <noreply@centr8.com>";
const ORIGIN = process.env.NEXT_PUBLIC_ORIGIN ?? "https://sitescore.centr8.com";

export interface SendReportEmailOptions {
  to:            string;
  hostname:      string;
  overallScore:  number;
  grade:         string;
  pdfBuffer:     Buffer;
  deletionToken: string;
}

/**
 * Send the branded PDF report as an email attachment via Resend.
 * Returns the Resend message ID on success.
 */
export async function sendReportEmail(opts: SendReportEmailOptions): Promise<string> {
  const { to, hostname, overallScore, grade, pdfBuffer, deletionToken } = opts;

  const gradeEmoji   = grade === "green" ? "🟢" : grade === "amber" ? "🟡" : "🔴";
  const gradeLabel   = grade === "green" ? "Good" : grade === "amber" ? "Needs Work" : "Critical";
  const deletionUrl  = `${ORIGIN}/delete?token=${encodeURIComponent(deletionToken)}`;

  const { data, error } = await getClient().emails.send({
    from:    FROM,
    to:      [to],
    subject: `Your SiteScore Report: ${hostname} — ${overallScore}/100 ${gradeEmoji}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:sans-serif;color:#f9fafb;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;color:#4F7BFF;margin:0 0 24px;">SiteScore</p>

    <p style="font-size:14px;color:#9ca3af;margin:0 0 16px;">
      Here's your website health report for <strong style="color:#f9fafb;">${hostname}</strong>.
    </p>

    <div style="background:#111827;border:1px solid #1f2937;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="font-size:11px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Overall Health Score</p>
      <p style="font-size:56px;font-weight:700;color:#4F7BFF;margin:0;line-height:1;">${overallScore}</p>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">/ 100 &nbsp;·&nbsp; ${gradeEmoji} ${gradeLabel}</p>
    </div>

    <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0 0 16px;">
      Your full branded PDF report is attached. It includes:
    </p>
    <ul style="font-size:13px;color:#9ca3af;line-height:1.8;padding-left:20px;margin:0 0 24px;">
      <li>All five category scores with business-impact analysis</li>
      <li>Prioritised fix roadmap with specific action steps</li>
      <li>Methodology notes and score explanation</li>
      <li>How to book a free consultation with Centr8</li>
    </ul>

    <a href="https://centr8.com/contact"
       style="display:inline-block;background:#4F7BFF;color:#fff;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
      Book a free consultation →
    </a>

    <hr style="border:none;border-top:1px solid #1f2937;margin:0 0 16px;">
    <p style="font-size:11px;color:#4b5563;margin:0 0 8px;">
      You're receiving this because you requested a SiteScore report.
      Centr8 · <a href="${ORIGIN}" style="color:#4b5563;">sitescore.centr8.com</a>
    </p>
    <p style="font-size:11px;color:#374151;margin:0;">
      <a href="${deletionUrl}" style="color:#6b7280;text-decoration:underline;">Request deletion of your data</a>
      &nbsp;·&nbsp;
      <a href="${ORIGIN}/privacy" style="color:#6b7280;text-decoration:underline;">Privacy policy</a>
    </p>
  </div>
</body>
</html>`,
    attachments: [
      {
        filename: `sitescore-${hostname}-report.pdf`,
        content:  pdfBuffer.toString("base64"),
      },
    ],
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  if (!data?.id) throw new Error("Resend returned no message ID");

  return data.id;
}
