import { academyConfigFromEnv, academyGrantConfigured, createAcademyRepository } from "./_academy/repository.js";
import { academyCookieName, parseCookies, safeReturnTo, sessionCookie } from "./_academy/security.js";
import { createControlRepository } from "./_control/repository.js";
import { controlShell } from "./_control/shell.js";

const JSON_LIMIT_BYTES = 96 * 1024;

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

function sessionToken(request, config) {
  return parseCookies(request.headers.get("cookie"))[academyCookieName(config.vercelEnv)] || "";
}

async function authenticate(request, config, academyRepository) {
  if (!academyGrantConfigured(config) || String(config.sessionSecret || "").length < 32) {
    throw Object.assign(new Error("mission_control_not_configured"), { status: 503 });
  }
  const token = sessionToken(request, config);
  if (!token) return null;
  const record = await academyRepository.getSession(token);
  if (!record) return { invalid: true, token };
  if (record.demo === true) return { subject: record.subject, emailMasked: record.emailMasked || "Modo presentación", demo: true, token };
  const entitlement = await academyRepository.getEntitlement(record.subject);
  if (!entitlement) {
    await academyRepository.revokeSession(token).catch(() => {});
    return { invalid: true, token };
  }
  return { subject: record.subject, emailMasked: record.emailMasked, demo: false, token };
}

async function requirePrincipal(request, config, academyRepository) {
  const principal = await authenticate(request, config, academyRepository);
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
  const academyRepository = createAcademyRepository(config, fetchImpl);
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
        const principal = await authenticate(request, config, academyRepository);
        if (!principal?.subject) {
          const headers = principal?.invalid ? { "Set-Cookie": sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 }) } : {};
          return responseJson({ authenticated: false }, 200, headers);
        }
        return responseJson({ authenticated: true, user: { email_masked: principal.emailMasked, demo: principal.demo } });
      }
      if (action === "state") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        const principal = await requirePrincipal(request, config, academyRepository);
        return responseJson(await controlRepository.getRecord(principal.subject, { demo: principal.demo, now: now() }));
      }
      if (action === "mutate") {
        if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
        requireTrustedOrigin(request, config);
        const principal = await requirePrincipal(request, config, academyRepository);
        const body = await readJson(request);
        const result = await controlRepository.mutate(principal.subject, body, { demo: principal.demo, now: now() });
        if (result.conflict) return responseJson({ error: "revision_conflict", revision: result.revision, state: result.state }, 409);
        return responseJson(result);
      }
      if (action === "demo-reset") {
        if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
        requireTrustedOrigin(request, config);
        const principal = await requirePrincipal(request, config, academyRepository);
        if (!principal.demo) return responseJson({ error: "demo_only" }, 403);
        return responseJson(await controlRepository.resetDemo(principal.subject, now()));
      }
      return responseJson({ error: "not_found" }, 404);
    } catch (error) {
      const status = Number(error?.status) || 503;
      const headers = error?.clearCookie ? { "Set-Cookie": sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 }) } : {};
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
