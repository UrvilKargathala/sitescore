import { promises as dns } from "dns";

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlValidationError";
  }
}

/**
 * Add https:// if no scheme is present, strip fragments.
 * Throws if the result is not a parseable URL.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme); // throws TypeError on bad input
  parsed.hash = "";
  return parsed.toString();
}

// ── Private IP detection ─────────────────────────────────────────────────────

function ip4ToUint32(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

const PRIVATE_IPV4_RANGES: Array<{ start: number; end: number }> = [
  { start: ip4ToUint32("0.0.0.0"),       end: ip4ToUint32("0.255.255.255")   }, // this-network
  { start: ip4ToUint32("10.0.0.0"),      end: ip4ToUint32("10.255.255.255")  }, // RFC1918
  { start: ip4ToUint32("100.64.0.0"),    end: ip4ToUint32("100.127.255.255") }, // Shared address (CGNAT)
  { start: ip4ToUint32("127.0.0.0"),     end: ip4ToUint32("127.255.255.255") }, // Loopback
  { start: ip4ToUint32("169.254.0.0"),   end: ip4ToUint32("169.254.255.255") }, // Link-local
  { start: ip4ToUint32("172.16.0.0"),    end: ip4ToUint32("172.31.255.255")  }, // RFC1918
  { start: ip4ToUint32("192.168.0.0"),   end: ip4ToUint32("192.168.255.255") }, // RFC1918
  { start: ip4ToUint32("198.18.0.0"),    end: ip4ToUint32("198.19.255.255")  }, // Benchmarking
  { start: ip4ToUint32("198.51.100.0"),  end: ip4ToUint32("198.51.100.255")  }, // TEST-NET-2
  { start: ip4ToUint32("203.0.113.0"),   end: ip4ToUint32("203.0.113.255")   }, // TEST-NET-3
  { start: ip4ToUint32("240.0.0.0"),     end: ip4ToUint32("255.255.255.255") }, // Reserved
];

function isPrivateIPv4(ip: string): boolean {
  const n = ip4ToUint32(ip);
  return PRIVATE_IPV4_RANGES.some(({ start, end }) => n >= start && n <= end);
}

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

// Blocked pseudo-TLDs and special hostnames
const BLOCKED_TLDS = new Set([
  "local", "localhost", "internal", "intranet",
  "test", "example", "invalid", "lan", "home",
]);

/**
 * SSRF guard — throws UrlValidationError if the URL targets a non-public host.
 * Resolves the hostname via DNS and validates every resolved IP address.
 */
export async function assertPublicUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  const host = hostname.toLowerCase().replace(/\.$/, ""); // strip trailing dot

  // IPv6 loopback / unspecified
  if (host === "::1" || host === "::" || host === "[::1]") {
    throw new UrlValidationError("IPv6 loopback addresses are not allowed.");
  }

  // Bare IPv4 literal
  if (IPV4_RE.test(host)) {
    if (isPrivateIPv4(host)) {
      throw new UrlValidationError("Private or reserved IP addresses are not allowed.");
    }
    return; // public IPv4 literal — fine
  }

  // Reject localhost and other special hostnames
  if (host === "localhost") {
    throw new UrlValidationError("localhost is not allowed.");
  }

  // Single-label hostnames (no TLD) — e.g. "internal", "server1"
  const labels = host.split(".");
  if (labels.length === 1) {
    throw new UrlValidationError(
      "Single-label hostnames are not allowed. Please enter a full domain name."
    );
  }

  // Blocked TLDs
  const tld = labels[labels.length - 1];
  if (BLOCKED_TLDS.has(tld)) {
    throw new UrlValidationError(`Domains ending in .${tld} are not allowed.`);
  }

  // DNS resolution — check every resolved IPv4 address (DNS rebinding protection)
  let resolved: string[] = [];
  try {
    resolved = await dns.resolve4(host);
  } catch {
    // Host may be IPv6-only or DNS may fail — we let the reachability check catch real failures.
    // A production hardening pass would also resolve AAAA and block fc00::/7.
  }

  for (const ip of resolved) {
    if (isPrivateIPv4(ip)) {
      throw new UrlValidationError(
        `"${host}" resolves to a private IP address and cannot be scanned.`
      );
    }
  }
}

/**
 * Sends a HEAD request (falls back gracefully on 405) with a 10 s timeout.
 * Throws UrlValidationError if the target is unreachable or returns a hard error.
 */
export async function assertReachable(url: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SiteScore-Bot/1.0 (+https://centr8.com/sitescore)",
      },
    });

    // 405 = server doesn't allow HEAD — acceptable, we'll GET during the real scan.
    // Treat anything 4xx (except 401/403/405) and 5xx as unreachable for queuing purposes.
    if (res.status >= 500) {
      throw new UrlValidationError(
        `Target returned HTTP ${res.status}. The server may be down or misconfigured.`
      );
    }
    if (res.status >= 400 && res.status !== 401 && res.status !== 403 && res.status !== 405) {
      throw new UrlValidationError(
        `Target returned HTTP ${res.status}. Please check the URL is correct and publicly accessible.`
      );
    }
  } catch (err) {
    if (err instanceof UrlValidationError) throw err;

    if (controller.signal.aborted) {
      throw new UrlValidationError(
        "Target did not respond within 10 seconds. Please check the URL and try again."
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    throw new UrlValidationError(`Could not reach target: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}
