import { academyConfigFromEnv } from "./_academy/repository.js";
import { constantTimeEqual, hmacDigest, parseCookies, safeReturnTo } from "./_academy/security.js";
import { createHash } from "node:crypto";
import { createControlRepository } from "./_control/repository.js";
import { controlShell } from "./_control/shell.js";
import { buildReminderCandidates, getTodaySummary, questCompletedForPeriod, questIsOverdue } from "../assets/control/mission-schedule.js";
import { buildQuestTreeIndex, getDirectQuestProgress, getQuestChildren, getQuestPath, sortSiblingQuests } from "../assets/control/mission-tree.js";
import { controlPushPublicConfig, createControlPushSender } from "./_control/push.js";

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

function requireCronAuthorization(request, env) {
  const secret = String(env.CRON_SECRET || "");
  const authorization = request.headers.get("authorization") || "";
  if (secret.length < 24 || !constantTimeEqual(authorization, `Bearer ${secret}`)) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }
}

function notificationPayload(candidate) {
  return {
    type: "mission-reminder",
    title: candidate.title,
    body: "Tienes una misión pendiente.",
    quest_id: candidate.quest_id,
    delivery_id: candidate.id,
    due_at: candidate.due_at,
    url: `/control/?reminder=${encodeURIComponent(candidate.id)}`,
  };
}

function mobileQuestView(state, index, quest, timestamp) {
  const direct = getDirectQuestProgress(index, quest.id, (item) => questCompletedForPeriod(state, item, timestamp) || (item.recurrence_type === "once" && item.status === "COMPLETED"));
  return {
    ...quest,
    child_count: direct.total,
    completed_child_count: direct.completed,
    ready_to_complete: direct.ready_to_complete && quest.status !== "COMPLETED",
    path: getQuestPath(index, quest.id).map((item) => ({ id: item.id, title: item.title })),
  };
}

function hierarchicalTodaySummary(state, timestamp) {
  const summary = getTodaySummary(state, timestamp);
  const index = buildQuestTreeIndex(state.quests);
  const decorate = (quest) => mobileQuestView(state, index, quest, timestamp);
  return {
    ...summary,
    missions: summary.missions.map(decorate),
    completed_missions: summary.completed_missions.map(decorate),
    overdue_missions: summary.overdue_missions.map(decorate),
  };
}

export function resolveControlAction(request) {
  return new URL(request.url).searchParams.get("action") || "";
}

export function createControlHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now(), sendPush = null, repository = null } = {}) {
  const config = academyConfigFromEnv(env);
  const controlRepository = repository || createControlRepository(config, fetchImpl);
  const pushSender = sendPush || createControlPushSender(env);
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
      if (action === "summary") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        const principal = requirePrincipal(request, config, now());
        const record = await controlRepository.getRecord(principal.subject, { demo: principal.demo, now: now() });
        return responseJson({ summary: hierarchicalTodaySummary(record.state, now()), revision: record.revision });
      }
      if (action === "quests") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        const principal = requirePrincipal(request, config, now());
        const record = await controlRepository.getRecord(principal.subject, { demo: principal.demo, now: now() });
        const parentId = new URL(request.url).searchParams.get("parent_id") || null;
        const index = buildQuestTreeIndex(record.state.quests);
        if (parentId && !index.byId.has(parentId)) return responseJson({ error: "quest_not_found" }, 404);
        const children = sortSiblingQuests(getQuestChildren(index, parentId), { isOverdue: (quest) => questIsOverdue(record.state, quest, now()) });
        return responseJson({ parent_id: parentId, quests: children.map((quest) => mobileQuestView(record.state, index, quest, now())), revision: record.revision });
      }
      if (action === "push-config") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        requirePrincipal(request, config, now());
        return responseJson(controlPushPublicConfig(env));
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
      if (action === "reminders-dispatch") {
        if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
        requireControlConfigured(config);
        requireCronAuthorization(request, env);
        if (!sendPush && !controlPushPublicConfig(env).available) throw Object.assign(new Error("push_not_configured"), { status: 503 });
        const subject = controlSubject(config);
        const timestamp = now();
        const record = await controlRepository.getRecord(subject, { now: timestamp });
        const subscriptions = record.state.preferences?.push_subscriptions || [];
        const candidates = buildReminderCandidates(record.state, timestamp).slice(0, 50);
        if (!subscriptions.length || !candidates.length) {
          return responseJson({ ok: true, candidates: candidates.length, sent: 0, subscriptions: subscriptions.length });
        }
        const delivered = [];
        const expiredEndpoints = new Set();
        let sent = 0;
        for (const candidate of candidates) {
          let candidateSent = false;
          for (const subscription of subscriptions) {
            try {
              await pushSender(subscription, notificationPayload(candidate));
              candidateSent = true;
              sent += 1;
            } catch (pushError) {
              if ([404, 410].includes(Number(pushError?.statusCode || pushError?.status))) expiredEndpoints.add(subscription.endpoint);
            }
          }
          if (candidateSent) delivered.push(candidate);
        }
        if (delivered.length) {
          await controlRepository.mutate(subject, {
            action: "reminder.mark-delivered",
            operation_id: `dispatch:${new Date(timestamp).toISOString()}`,
            payload: { deliveries: delivered },
          }, { now: timestamp });
        }
        for (const endpoint of expiredEndpoints) {
          await controlRepository.mutate(subject, {
            action: "push.unsubscribe",
            operation_id: `push-expired:${createHash("sha256").update(endpoint).digest("hex").slice(0, 32)}`,
            payload: { endpoint },
          }, { now: timestamp });
        }
        return responseJson({ ok: true, candidates: candidates.length, delivered: delivered.length, sent, removed_subscriptions: expiredEndpoints.size });
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
