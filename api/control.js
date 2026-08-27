import { academyConfigFromEnv } from "./_academy/repository.js";
import { constantTimeEqual, hmacDigest, parseCookies, safeReturnTo } from "./_academy/security.js";
import { createHash } from "node:crypto";
import { createControlRepository } from "./_control/repository.js";
import { controlShell } from "./_control/shell.js";

const JSON_LIMIT_BYTES = 96 * 1024;
const DEFAULT_ACCESS_CODE_DIGEST = "48a93874fd02e9c67f5f205f1e6f8ef665a8ba3b05b901aeb0780605bb5f31f4";

function securityHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    ...extra,
  };
}

function responseJson(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: securityHeaders(headers) });
}

function responseHtml(body, status = 200) {
  return new Response(body, {
    status,
    headers: securityHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    }),
  });
}

async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > JSON_LIMIT_BYTES) throw Object.assign(new Error("payload_too_large"), { status: 413 });
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > JSON_LIMIT_BYTES) throw Object.assign(new Error("payload_too_large"), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

function trustedOrigin(request, config) {
  if (["development", "test"].includes(config.vercelEnv)) return true;
  const origin = request.headers.get("origin") || "";
  try { return Boolean(origin && (origin === new URL(request.url).origin || origin === config.baseUrl)); } catch { return false; }
}

function requireTrustedOrigin(request, config) {
  if (!trustedOrigin(request, config)) throw Object.assign(new Error("untrusted_origin"), { status: 403 });
}

function controlConfigured(config) {
  return Boolean(
    config?.redisUrl
    && config?.redisToken
    && String(config?.dataSecret || "").length >= 32
    && String(config?.sessionSecret || "").length >= 32
  );
}

function requireControlConfigured(config) {
  if (!controlConfigured(config)) {
    throw Object.assign(new Error("mission_control_not_configured"), { status: 503 });
  }
}

function controlCookieName(vercelEnv) {
  return !["development", "test"].includes(String(vercelEnv || "development")) ? "__Host-ivan_control" : "ivan_control";
}

function controlSessionCookie(token, config, maxAge = 0) {
  const parts = [
    `${controlCookieName(config.vercelEnv)}=${encodeURIComponent(token || "")}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (!["development", "test"].includes(String(config.vercelEnv || "development"))) parts.push("Secure");
  return parts.join("; ");
}

function controlSubject(config) {
  return hmacDigest("owner", config.dataSecret, "mission-control-owner-v1");
}

function createControlSession(config, timestamp) {
  const expiresAt = timestamp + (config.sessionTtl * 1000);
  const payload = `v1.${expiresAt}`;
  const signature = hmacDigest(payload, config.sessionSecret, "mission-control-session-v1");
  return `${payload}.${signature}`;
}

function validAccessCode(value, configuredCode) {
  const submitted = String(value || "").trim().slice(0, 128);
  if (!submitted) return false;
  if (configuredCode) return constantTimeEqual(submitted, String(configuredCode));
  const digest = createHash("sha256").update(submitted, "utf8").digest("hex");
  return constantTimeEqual(digest, DEFAULT_ACCESS_CODE_DIGEST);
}

function authenticate(request, config, timestamp) {
  requireControlConfigured(config);
  const token = parseCookies(request.headers.get("cookie"))[controlCookieName(config.vercelEnv)] || "";
  if (!token) return null;
  const [version, expiresAtRaw, signature, ...extra] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  const payload = `${version}.${expiresAtRaw}`;
  const expected = hmacDigest(payload, config.sessionSecret, "mission-control-session-v1");
  if (extra.length || version !== "v1" || !Number.isSafeInteger(expiresAt) || expiresAt <= timestamp || !constantTimeEqual(signature, expected)) {
    return { invalid: true };
  }
  return { subject: controlSubject(config), emailMasked: "Acceso privado", demo: false };
}

function requirePrincipal(request, config, timestamp) {
  const principal = authenticate(request, config, timestamp);
  if (!principal?.subject) throw Object.assign(new Error("unauthorized"), { status: 401, clearCookie: Boolean(principal?.invalid) });
  return principal;
}

function safeControlRoute(value) {
  const route = safeReturnTo(value, "https://ivanimports.es");
  return route.startsWith("/control") ? route : "/control/";
}

export function resolveControlAction(request) {
  return new URL(request.url).searchParams.get("action") || "";
}

export function createControlHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const config = academyConfigFromEnv(env);
  const controlRepository = createControlRepository(config, fetchImpl);
  return async function handler(request) {
    const action = resolveControlAction(request);
    try {
      if (action === "page") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        return responseHtml(controlShell({ route: safeControlRoute(new URL(request.url).searchParams.get("route")) }));
      }
      if (action === "session") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        const principal = authenticate(request, config, now());
        if (!principal?.subject) {
          const headers = principal?.invalid ? { "Set-Cookie": controlSessionCookie("", config, 0) } : {};
          return responseJson({ authenticated: false }, 200, headers);
        }
        return responseJson({ authenticated: true, user: { email_masked: principal.emailMasked, demo: principal.demo } });
      }
      if (action === "login") {
        if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
        requireTrustedOrigin(request, config);
        requireControlConfigured(config);
        const body = await readJson(request);
        if (!validAccessCode(body.code, env.MISSION_CONTROL_ACCESS_CODE)) {
          return responseJson({ error: "invalid_access_code", message: "Código incorrecto." }, 401);
        }
        const token = createControlSession(config, now());
        return responseJson(
          { authenticated: true, user: { email_masked: "Acceso privado", demo: false } },
          200,
          { "Set-Cookie": controlSessionCookie(token, config, config.sessionTtl) },
        );
      }
      if (action === "state") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        const principal = requirePrincipal(request, config, now());
        return responseJson(await controlRepository.getRecord(principal.subject, { demo: principal.demo, now: now() }));
      }
      if (action === "mutate") {
        if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
        requireTrustedOrigin(request, config);
        const principal = requirePrincipal(request, config, now());
        const body = await readJson(request);
        const result = await controlRepository.mutate(principal.subject, body, { demo: principal.demo, now: now() });
        if (result.conflict) return responseJson({ error: "revision_conflict", revision: result.revision, state: result.state }, 409);
        return responseJson(result);
      }
      if (action === "demo-reset") {
        if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
        requireTrustedOrigin(request, config);
        const principal = requirePrincipal(request, config, now());
        if (!principal.demo) return responseJson({ error: "demo_only" }, 403);
        return responseJson(await controlRepository.resetDemo(principal.subject, now()));
      }
      return responseJson({ error: "not_found" }, 404);
    } catch (error) {
      const status = Number(error?.status) || 503;
      const headers = error?.clearCookie ? { "Set-Cookie": controlSessionCookie("", config, 0) } : {};
      const code = error?.code || (status >= 500 ? "service_unavailable" : error?.message || "request_failed");
      if (status >= 500) console.info(JSON.stringify({ event: "mission_control_api_error", action, reason: String(error?.message || error).slice(0, 100) }));
      return responseJson({ error: code, message: code, ...(error?.details ? { details: error.details } : {}) }, status, headers);
    }
  };
}

const handler = createControlHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
