/**
 * Security probe — read-only, non-intrusive.
 * Only makes HEAD/GET requests to the root path of the target URL.
 * No port scanning, no path enumeration, no payload injection.
 */
import https from "https";
import http from "http";
import tls from "tls";

// ── Result types ──────────────────────────────────────────────────────────────

export interface SecurityFindings {
  fetchedAt: string;
  error: string | null;

  https: {
    served: boolean;
    httpRedirectsToHttps: boolean | null; // null = HTTP port unreachable
  };

  tls: {
    valid: boolean;
    expired: boolean;
    selfSigned: boolean;
    trusted: boolean;
    expiresAt: string | null;
    issuer: string | null;
    error: string | null;
  };

  headers: {
    hsts:                { present: boolean; value: string | null };
    csp:                 { present: boolean; value: string | null };
    xFrameOptions:       { present: boolean; value: string | null };
    xContentTypeOptions: { present: boolean; value: string | null };
    referrerPolicy:      { present: boolean; value: string | null };
    permissionsPolicy:   { present: boolean; value: string | null };
  };

  versionBanners: {
    server:     { exposed: boolean; value: string | null };
    xPoweredBy: { exposed: boolean; value: string | null };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function looksLikeVersionBanner(value: string | null): boolean {
  if (!value) return false;
  return /\/\d+\.\d+/.test(value) || /\b\d+\.\d+\.\d+\b/.test(value);
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// ── TLS check ─────────────────────────────────────────────────────────────────

function checkTLS(hostname: string): Promise<SecurityFindings["tls"]> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname,
        port: 443,
        method: "HEAD",
        path: "/",
        rejectUnauthorized: false, // get cert details even when invalid
        timeout: 8_000,
      },
      (res) => {
        const socket = res.socket as tls.TLSSocket;
        const cert = socket.getPeerCertificate(false);
        const authorized: boolean = socket.authorized;
        const authError = socket.authorizationError
          ? String(socket.authorizationError)
          : null;

        const expiresAt = cert?.valid_to ?? null;
        const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
        const selfSigned =
          !!authError &&
          (authError.includes("SELF_SIGNED") || authError.includes("self signed"));

        resolve({
          valid: authorized,
          expired,
          selfSigned,
          trusted: authorized && !expired && !selfSigned,
          expiresAt,
          issuer: Array.isArray(cert?.issuer?.O)
            ? (cert.issuer.O[0] ?? null)
            : (cert?.issuer?.O ?? null),
          error: authError,
        });
        req.destroy();
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ valid: false, expired: false, selfSigned: false, trusted: false,
                expiresAt: null, issuer: null, error: "TLS check timed out" });
    });

    req.on("error", (err) => {
      resolve({ valid: false, expired: false, selfSigned: false, trusted: false,
                expiresAt: null, issuer: null, error: err.message });
    });

    req.end();
  });
}

// ── HTTP→HTTPS redirect check ─────────────────────────────────────────────────

function checkHttpRedirect(hostname: string, path: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname, port: 80, method: "HEAD", path, timeout: 5_000 },
      (res) => {
        const raw = res.headers["location"];
        const location = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
        resolve(
          res.statusCode !== undefined &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          location !== null &&
          location.startsWith("https://")
        );
      }
    );
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null)); // port 80 unreachable → null
    req.end();
  });
}

// ── Header fetch ──────────────────────────────────────────────────────────────

async function fetchRootHeaders(
  url: string
): Promise<Record<string, string | string[] | undefined>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "SiteScore-Bot/1.0 (+https://centr8.com/sitescore)" },
    });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => { out[k.toLowerCase()] = v; });
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runSecurityProbe(url: string): Promise<SecurityFindings> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const path = parsed.pathname || "/";
  const isHttps = parsed.protocol === "https:";

  const findings: SecurityFindings = {
    fetchedAt: new Date().toISOString(),
    error: null,
    https: { served: false, httpRedirectsToHttps: null },
    tls: { valid: false, expired: false, selfSigned: false, trusted: false,
           expiresAt: null, issuer: null, error: null },
    headers: {
      hsts:                { present: false, value: null },
      csp:                 { present: false, value: null },
      xFrameOptions:       { present: false, value: null },
      xContentTypeOptions: { present: false, value: null },
      referrerPolicy:      { present: false, value: null },
      permissionsPolicy:   { present: false, value: null },
    },
    versionBanners: {
      server:     { exposed: false, value: null },
      xPoweredBy: { exposed: false, value: null },
    },
  };

  // Non-HTTPS target — record as a finding, still check HTTP redirect
  if (!isHttps) {
    findings.https.served = false;
    findings.https.httpRedirectsToHttps = await checkHttpRedirect(hostname, path);
    return findings;
  }

  findings.https.served = true;

  // TLS and HTTP redirect run concurrently — both are independent TCP connects
  const [tlsResult, httpRedirect] = await Promise.all([
    checkTLS(hostname),
    checkHttpRedirect(hostname, path),
  ]);

  findings.tls = tlsResult;
  findings.https.httpRedirectsToHttps = httpRedirect;

  // Fetch response headers from root page
  let responseHeaders: Record<string, string | string[] | undefined> = {};
  try {
    responseHeaders = await fetchRootHeaders(url);
  } catch (err) {
    findings.error = `Header fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    return findings;
  }

  const h = (name: string) => getHeader(responseHeaders, name);

  findings.headers = {
    hsts:                { present: !!h("strict-transport-security"), value: h("strict-transport-security") },
    csp:                 { present: !!h("content-security-policy"),   value: h("content-security-policy") },
    xFrameOptions:       { present: !!h("x-frame-options"),           value: h("x-frame-options") },
    xContentTypeOptions: { present: !!h("x-content-type-options"),    value: h("x-content-type-options") },
    referrerPolicy:      { present: !!h("referrer-policy"),           value: h("referrer-policy") },
    permissionsPolicy:   { present: !!h("permissions-policy"),        value: h("permissions-policy") },
  };

  const serverVal     = h("server");
  const xPoweredByVal = h("x-powered-by");

  findings.versionBanners = {
    server:     { exposed: looksLikeVersionBanner(serverVal),     value: serverVal },
    xPoweredBy: { exposed: looksLikeVersionBanner(xPoweredByVal), value: xPoweredByVal },
  };

  return findings;
}
