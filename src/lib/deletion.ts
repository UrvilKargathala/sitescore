/**
 * FR-13 — Deletion-on-request helpers.
 *
 * Tokens: HMAC-SHA256(leadId, DELETION_SECRET) encoded as URL-safe base64.
 * Signed tokens mean deletion links work without authentication and can't be
 * forged to delete arbitrary records.
 *
 * Retention: Lead PII is hard-deleted after RETENTION_MONTHS. The scan record
 * itself is retained for aggregate stats, but the Lead row (email, consent,
 * delivery fields) is permanently removed. Only the fact + timestamp of deletion
 * is logged — never the data.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";

export const RETENTION_MONTHS = 12;

function secret(): string {
  const s = process.env.DELETION_SECRET;
  if (!s) throw new Error("DELETION_SECRET env var is not set");
  return s;
}

// ── Token generation / verification ──────────────────────────────────────────

export function makeDeletionToken(leadId: string): string {
  const sig = createHmac("sha256", secret()).update(leadId).digest("base64url");
  // Include leadId in the token so the endpoint can look it up without a DB round-trip
  return Buffer.from(`${leadId}:${sig}`).toString("base64url");
}

export function parseDeletionToken(token: string): string | null {
  try {
    const decoded  = Buffer.from(token, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx < 1) return null;

    const leadId = decoded.slice(0, colonIdx);
    const sig    = decoded.slice(colonIdx + 1);

    // Verify HMAC to reject forged tokens
    const expected = createHmac("sha256", secret()).update(leadId).digest("base64url");
    const sigBuf   = Buffer.from(sig);
    const expBuf   = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    return leadId;
  } catch {
    return null;
  }
}

// ── Hard delete a single lead (by id or email) ────────────────────────────────

export interface DeletionResult {
  deleted: number; // number of lead rows removed
}

export async function deleteLeadById(leadId: string): Promise<DeletionResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { deleted: 0 };

  await prisma.lead.delete({ where: { id: leadId } });

  // Audit log — only fact + timestamp, never data
  console.log(`[deletion] lead ${leadId} permanently deleted at ${new Date().toISOString()}`);
  return { deleted: 1 };
}

export async function deleteLeadsByEmail(email: string): Promise<DeletionResult> {
  const normalised = email.trim().toLowerCase();
  const leads = await prisma.lead.findMany({
    where: { email: normalised },
    select: { id: true },
  });
  if (!leads.length) return { deleted: 0 };

  await prisma.lead.deleteMany({ where: { email: normalised } });

  console.log(
    `[deletion] ${leads.length} lead(s) for email hash deleted at ${new Date().toISOString()}`
  );
  return { deleted: leads.length };
}

// ── Retention sweep — purge leads past their expiry date ─────────────────────

export async function purgeExpiredLeads(): Promise<number> {
  const now = new Date();

  // Find expired lead IDs before deleting (for audit count)
  const expired = await prisma.lead.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true },
  });

  if (!expired.length) {
    console.log("[retention] no expired leads found");
    return 0;
  }

  const ids = expired.map((l) => l.id);
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `[retention] purged ${ids.length} expired lead(s) at ${now.toISOString()}`
  );
  return ids.length;
}
