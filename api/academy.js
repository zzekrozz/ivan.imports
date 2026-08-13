import { get as getPrivateBlob } from "@vercel/blob";
import { demoProgram, privateProgram } from "./_academy/content.js";
import {
  academyGrantConfigured,
  academyConfigFromEnv,
  createAcademyRepository,
} from "./_academy/repository.js";
import {
  ACADEMY_PROGRAM_ID,
  academyCookieName,
  constantTimeEqual,
  emailHash,
  hmacDigest,
  maskAcademyEmail,
  normalizeEmail,
  parseCookies,
  randomOpaqueToken,
  randomSixDigitCode,
  requestIp,
  safeReturnTo,
  safeRoute,
  sessionCookie,
  validateAcademyState,
} from "./_academy/security.js";
import { academyShell } from "./_academy/shell.js";
import { academyBlobSdkOptions, academyPrivateBlobOptions } from "./_academy/blob.js";

const JSON_LIMIT_BYTES = 320 * 1024;
const CODE_ATTEMPTS = 5;
const NEUTRAL_REQUEST_MESSAGE = "Si existe un acceso asociado a este email, recibirás las instrucciones en unos instantes.";

function securityHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extra,
  };
}

function responseJson(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: securityHeaders(headers) });
}

function responseHtml(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: securityHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...headers,
    }),
  });
}

function responseRedirect(location, status = 303, headers = {}) {
  return new Response(null, { status, headers: securityHeaders({ Location: location, ...headers }) });
}

function logAcademy(event, details = {}) {
  console.info(JSON.stringify({ event, product: ACADEMY_PROGRAM_ID, ...details }));
}

function safeError(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function readJson(request, maximum = JSON_LIMIT_BYTES) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maximum) throw Object.assign(new Error("payload_too_large"), { status: 413 });
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maximum) throw Object.assign(new Error("payload_too_large"), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

function trustedOrigin(request, config) {
  if (["development", "test"].includes(config.vercelEnv)) return true;
  const origin = request.headers.get("origin") || "";
  let requestOrigin = "";
  try { requestOrigin = new URL(request.url).origin; } catch {}
  return Boolean(origin && (origin === requestOrigin || origin === config.baseUrl));
}

function requireTrustedOrigin(request, config) {
  if (!trustedOrigin(request, config)) throw Object.assign(new Error("untrusted_origin"), { status: 403 });
}

function requireAuthConfiguration(config, { emailDelivery = false } = {}) {
  const coreConfigured = academyGrantConfigured(config)
    && String(config?.authSecret || "").length >= 32
    && String(config?.sessionSecret || "").length >= 32;
  if (!coreConfigured || (emailDelivery && (!config.resendApiKey || !config.resendFrom))) {
    throw Object.assign(new Error("academy_not_configured"), { status: 503 });
  }
}

function requireRepositoryConfiguration(config) {
  if (!academyGrantConfigured(config) || String(config?.sessionSecret || "").length < 32) {
    throw Object.assign(new Error("academy_not_configured"), { status: 503 });
  }
}

function sessionTokenFromRequest(request, config) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[academyCookieName(config.vercelEnv)] || "";
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function requireBearerSecret(request, configured, minimumLength = 32) {
  const provided = bearerToken(request);
  if (String(configured || "").length < minimumLength || !provided || !constantTimeEqual(provided, configured)) {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }
}

function demoPrincipal(request, config) {
  if (!config.demoToken || config.demoToken.length < 24) return null;
  const provided = bearerToken(request);
  if (!constantTimeEqual(provided, config.demoToken)) return null;
  return { subject: "demo", emailMasked: "demo@ivanimports.es", demo: true };
}

async function authenticate(request, config, repository) {
  const demo = demoPrincipal(request, config);
  if (demo) return { principal: demo, token: "", record: null, entitlement: { status: "active", programId: ACADEMY_PROGRAM_ID }, demo: true };

  const token = sessionTokenFromRequest(request, config);
  if (!token) return null;
  const record = await repository.getSession(token);
  if (!record) return { invalid: true, token };
  if (record.demo === true) {
    return {
      principal: { subject: record.subject, emailMasked: record.emailMasked || "Modo presentación", demo: true },
      token,
      record,
      entitlement: { status: "active", programId: ACADEMY_PROGRAM_ID },
      demo: true,
    };
  }
  const entitlement = await repository.getEntitlement(record.subject);
  if (!entitlement) {
    await repository.revokeSession(token);
    return { invalid: true, token, noEntitlement: true };
  }
  return { principal: { subject: record.subject, emailMasked: record.emailMasked, demo: false }, token, record, entitlement, demo: false };
}

async function requirePrincipal(request, config, repository) {
  const authentication = await authenticate(request, config, repository);
  if (!authentication?.principal) throw Object.assign(new Error(authentication?.noEntitlement ? "no_entitlement" : "unauthorized"), { status: authentication?.noEntitlement ? 403 : 401, clearCookie: true });
  return authentication;
}

async function rateLimitAuthentication(repository, config, request, scope, subject, limits) {
  const ipDigest = hmacDigest(requestIp(request), config.dataSecret, "academy-ip-v1");
  const ip = await repository.rateLimit(`${scope}:ip`, ipDigest, limits.ip, limits.window);
  const identity = subject ? await repository.rateLimit(`${scope}:email`, subject, limits.email, limits.window) : { allowed: true, retryAfter: 1 };
  const combination = subject
    ? await repository.rateLimit(`${scope}:pair`, hmacDigest(`${subject}:${ipDigest}`, config.dataSecret, "academy-pair-v1"), limits.pair || limits.email, limits.window)
    : { allowed: true, retryAfter: 1 };
  if (!ip.allowed || !identity.allowed || !combination.allowed) {
    const retryAfter = Math.max(ip.retryAfter, identity.retryAfter, combination.retryAfter);
    throw Object.assign(new Error("rate_limited"), { status: 429, retryAfter });
  }
}

function entitlementView(entitlement, config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const bonusEligible = Boolean(entitlement?.bonusEligible);
  const supportExpiresAt = entitlement?.supportExpiresAt || "";
  const supportExpirySeconds = supportExpiresAt ? Math.floor(Date.parse(supportExpiresAt) / 1000) : 0;
  const supportActive = bonusEligible && (!supportExpiresAt || (Number.isFinite(supportExpirySeconds) && supportExpirySeconds > nowSeconds));
  const phone = /^\d{8,15}$/.test(config.supportPhone || "") ? config.supportPhone : "";
  return {
    entitlement: {
      program_id: ACADEMY_PROGRAM_ID,
      status: "active",
      bonus_eligible: bonusEligible,
      support_expires_at: supportExpiresAt || null,
    },
    ...(bonusEligible ? {
      support: {
        eligible: true,
        status: supportActive ? "active" : "expired",
        endsAt: supportExpiresAt || null,
        ...(supportActive && phone ? { url: `https://wa.me/${phone}` } : {}),
      },
    } : {}),
  };
}

function adminLabel(value, fallback) {
  const label = String(value || fallback).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(label)) throw Object.assign(new Error("invalid_admin_label"), { status: 400 });
  return label;
}

function optionalIsoDate(value, field) {
  if (value === undefined || value === null || value === "") return "";
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) throw Object.assign(new Error(`invalid_${field}`), { status: 400 });
  return new Date(timestamp).toISOString();
}

async function sendAccessEmail({ email, code, subject, config, fetchImpl }) {
  const accessUrl = new URL("/academia/acceso/", config.baseUrl);
  const payload = {
    from: config.resendFrom,
    to: [email],
    subject: "Tu código de acceso · Academia IvanImports",
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f7fb;font-family:Arial,sans-serif;color:#102231"><table role="presentation" width="100%"><tr><td style="padding:32px 16px"><div style="max-width:520px;margin:auto;padding:34px;background:#fff;border:1px solid #dce7f0;border-radius:20px"><p style="color:#0b68e8;font-size:12px;font-weight:800;letter-spacing:.12em">ACADEMIA IVANIMPORTS</p><h1>Tu código de acceso</h1><p>Introduce estos seis números en la pantalla de acceso:</p><p style="padding:18px;border-radius:14px;background:#edf5ff;color:#074fc4;font-size:34px;font-weight:800;letter-spacing:.28em;text-align:center">${escapeHtml(code)}</p><p>Este código caduca en <strong>10 minutos</strong> y solo puede utilizarse una vez.</p><p>No necesitas contraseña para entrar.</p><p><a href="${escapeHtml(accessUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#0b68e8;color:#fff;font-weight:700;text-decoration:none">Volver a Academia IvanImports</a></p><p style="color:#718196;font-size:13px">El botón no inicia sesión. Si no has solicitado este código, puedes ignorar el mensaje.</p></div></td></tr></table></body></html>`,
    text: `ACADEMIA IVANIMPORTS\n\nTU CÓDIGO DE ACCESO\n\n${code}\n\nEste código caduca en 10 minutos y solo puede utilizarse una vez.\nNo necesitas contraseña para entrar.\n\nVolver a Academia IvanImports: ${accessUrl}\n\nEl enlace no inicia sesión. Si no has solicitado este código, puedes ignorar este mensaje.`,
    tags: [
      { name: "product", value: ACADEMY_PROGRAM_ID },
      { name: "email_type", value: "passwordless_access" },
    ],
  };
  const idempotency = hmacDigest(`${subject}:${code}`, config.authSecret, "academy-resend-v2");
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `academy-auth/${idempotency}`,
      "User-Agent": "IvanImports-Academy/1.0",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Academy access email failed (${response.status})`);
  return response.json().catch(() => ({}));
}

async function handleAuthRequest(request, config, repository, dependencies) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireTrustedOrigin(request, config);
  requireAuthConfiguration(config, { emailDelivery: true });
  const startedAt = Date.now();
  const neutralResponse = async () => {
    const remaining = dependencies.authRequestMinimumMs - (Date.now() - startedAt);
    if (remaining > 0) await dependencies.sleep(remaining);
    return responseJson({ ok: true, message: NEUTRAL_REQUEST_MESSAGE, retry_after: config.resendCooldown }, 202);
  };
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const subject = email ? emailHash(email, config.dataSecret) : "";
  await rateLimitAuthentication(repository, config, request, "request-window", subject, { ip: 30, email: 8, pair: 8, window: 15 * 60 });
  await rateLimitAuthentication(repository, config, request, "request-cooldown", subject, { ip: 12, email: 1, pair: 1, window: config.resendCooldown });
  if (!email || !subject) return neutralResponse();

  const entitlement = await repository.getEntitlement(subject);
  if (!entitlement) return neutralResponse();

  const returnTo = safeReturnTo(body?.returnTo, config.baseUrl);
  const code = dependencies.randomCode();
  const codeDigest = hmacDigest(`${subject}:${code}`, config.authSecret, "academy-code-v1");
  await repository.issueChallenge({
    subject,
    codeDigest,
    emailMasked: maskAcademyEmail(email),
    returnTo,
    ttl: config.codeTtl,
    nowSeconds: dependencies.nowSeconds(),
  });

  try {
    await sendAccessEmail({ email, code, subject, config, fetchImpl: dependencies.fetchImpl });
    logAcademy("academy_auth_email_sent", { subject_ref: subject.slice(0, 10) });
  } catch (error) {
    await repository.invalidateActiveChallenge(subject).catch(() => {});
    logAcademy("academy_auth_email_failed", { subject_ref: subject.slice(0, 10), reason: safeError(error).slice(0, 80) });
  }
  return neutralResponse();
}

async function establishSession(record, config, repository, dependencies) {
  const entitlement = await repository.getEntitlement(record.subject);
  if (!entitlement) throw Object.assign(new Error("no_entitlement"), { status: 403 });
  const created = await repository.createSession({ subject: record.subject, emailMasked: record.emailMasked, nowSeconds: dependencies.nowSeconds() });
  return {
    body: { authenticated: true, redirectTo: safeReturnTo(record.returnTo, config.baseUrl), returnTo: safeReturnTo(record.returnTo, config.baseUrl) },
    cookie: sessionCookie(created.token, { vercelEnv: config.vercelEnv, maxAge: config.sessionTtl }),
  };
}

async function handleAuthVerify(request, config, repository, dependencies) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireTrustedOrigin(request, config);
  requireAuthConfiguration(config);
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const code = String(body?.code || "");
  const subject = email ? emailHash(email, config.dataSecret) : "";
  await rateLimitAuthentication(repository, config, request, "verify", subject, { ip: 40, email: 12, window: 15 * 60 });
  if (!subject || !/^\d{6}$/.test(code)) return responseJson({ error: "invalid_code", message: "Código no válido o caducado." }, 401);
  const codeDigest = hmacDigest(`${subject}:${code}`, config.authSecret, "academy-code-v1");
  const consumed = await repository.consumeCode({ subject, codeDigest, maxAttempts: CODE_ATTEMPTS, ttl: config.codeTtl, nowSeconds: dependencies.nowSeconds() });
  if (consumed?.status === "expired") return responseJson({ error: "code_expired", message: "Este c\u00f3digo ha caducado." }, 401);
  if (consumed?.status === "used") return responseJson({ error: "code_used", message: "Este c\u00f3digo ya no es v\u00e1lido." }, 401);
  if (consumed?.status === "locked") return responseJson({ error: "code_locked", message: "Este c\u00f3digo ya no es v\u00e1lido." }, 401);
  const record = consumed?.record || null;
  if (!record) return responseJson({ error: "invalid_code", message: "Código no válido o caducado." }, 401);
  const established = await establishSession(record, config, repository, dependencies);
  logAcademy("academy_auth_success", { method: "code", subject_ref: subject.slice(0, 10) });
  return responseJson(established.body, 200, { "Set-Cookie": established.cookie });
}

async function handleDemo(request, config, repository, dependencies) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireRepositoryConfiguration(config);
  requireBearerSecret(request, config.demoToken, 24);
  const created = await repository.createSession({
    subject: "demo",
    emailMasked: "Modo presentación",
    demo: true,
    ttl: config.demoSessionTtl,
    nowSeconds: dependencies.nowSeconds(),
  });
  logAcademy("academy_demo_session_created");
  return responseJson({ ok: true, authenticated: true, demo: true, redirectTo: safeReturnTo() }, 200, {
    "Set-Cookie": sessionCookie(created.token, { vercelEnv: config.vercelEnv, maxAge: config.demoSessionTtl }),
  });
}

async function handleAdminEntitlement(request, config, repository) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireBearerSecret(request, config.adminApiToken, 32);
  if (!academyGrantConfigured(config)) throw Object.assign(new Error("academy_not_configured"), { status: 503 });
  const body = await readJson(request);
  if (body?.programId !== ACADEMY_PROGRAM_ID) return responseJson({ error: "invalid_program" }, 400);
  const email = normalizeEmail(body?.email);
  const subject = email ? emailHash(email, config.dataSecret) : "";
  if (!subject) return responseJson({ error: "invalid_email" }, 400);

  if (body?.action === "grant-entitlement") {
    const source = adminLabel(body.source, "manual-admin");
    const purchasedAt = optionalIsoDate(body.paidAt, "paid_at");
    const supportExpiresAt = optionalIsoDate(body.supportExpiresAt, "support_expires_at");
    if (body.bonusEligible !== undefined && typeof body.bonusEligible !== "boolean") return responseJson({ error: "invalid_bonus" }, 400);
    const entitlement = await repository.grantEntitlement({
      subject,
      sourceSessionId: `admin:${source}:${subject}`,
      purchasedAt,
      bonusEligible: Boolean(body.bonusEligible),
      supportExpiresAt,
      allowReactivation: true,
    });
    logAcademy("academy_admin_entitlement_granted", { subject_ref: subject.slice(0, 10), source, reactivated: Boolean(entitlement.reactivated) });
    return responseJson({ ok: true, status: "active", duplicate: Boolean(entitlement.idempotent), unchanged: Boolean(entitlement.idempotent), reactivated: Boolean(entitlement.reactivated) });
  }

  if (body?.action === "revoke-entitlement") {
    const reason = adminLabel(body.reason, "manual-admin");
    const result = await repository.revokeEntitlement(subject, reason);
    logAcademy("academy_admin_entitlement_revoked", { subject_ref: subject.slice(0, 10), reason, sessions_revoked: result.sessionsRevoked });
    return responseJson({ ok: true, status: "revoked", unchanged: Boolean(result.unchanged), sessions_revoked: result.sessionsRevoked });
  }

  return responseJson({ error: "invalid_admin_action" }, 400);
}

async function handleSession(request, config, repository, dependencies) {
  if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  requireRepositoryConfiguration(config);
  const authentication = await authenticate(request, config, repository);
  if (!authentication?.principal) {
    const headers = authentication?.invalid ? { "Set-Cookie": sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 }) } : {};
    return responseJson({ authenticated: false }, 200, headers);
  }
  if (authentication.demo) return responseJson({ authenticated: true, user: { email_masked: authentication.principal.emailMasked, demo: true }, redirectTo: safeReturnTo() });
  const rotated = await repository.rotateSession(authentication.token, authentication.record, dependencies.nowSeconds());
  return responseJson({
    authenticated: true,
    user: { email_masked: authentication.principal.emailMasked },
    ...entitlementView(authentication.entitlement, config, dependencies.nowSeconds()),
    redirectTo: safeReturnTo(),
  }, 200, { "Set-Cookie": sessionCookie(rotated.token, { vercelEnv: config.vercelEnv, maxAge: Math.max(60, rotated.record.expiresAt - dependencies.nowSeconds()) }) });
}

async function handleProgram(request, config, repository, dependencies) {
  if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const authentication = await requirePrincipal(request, config, repository);
  if (authentication.demo) return responseJson({ program: demoProgram(), entitlement: { status: "demo", program_id: ACADEMY_PROGRAM_ID } });
  const program = await dependencies.contentLoader({ config, blobGet: dependencies.blobGet });
  return responseJson({ program, ...entitlementView(authentication.entitlement, config, dependencies.nowSeconds()) });
}

async function handleState(request, config, repository) {
  if (!new Set(["GET", "PUT"]).has(request.method)) return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET, PUT" });
  if (request.method === "PUT") requireTrustedOrigin(request, config);
  const authentication = await requirePrincipal(request, config, repository);
  if (authentication.demo) {
    if (request.method === "PUT") return responseJson({ error: "demo_read_only" }, 403);
    return responseJson({ state: { version: 1, progress: {}, operation: {}, candidates: [], tools: {} }, revision: 0, updatedAt: null });
  }
  if (request.method === "GET") return responseJson(await repository.getState(authentication.principal.subject));
  const body = await readJson(request);
  let state;
  try { state = validateAcademyState(body?.state); } catch (error) { return responseJson({ error: safeError(error) }, 400); }
  const revision = body?.revision === undefined ? undefined : Number(body.revision);
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 0)) return responseJson({ error: "invalid_revision" }, 400);
  const saved = await repository.putState(authentication.principal.subject, state, revision);
  if (saved.conflict) return responseJson({ error: "revision_conflict", revision: saved.revision }, 409);
  return responseJson(saved);
}

async function handleLogout(request, config, repository) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireTrustedOrigin(request, config);
  const token = sessionTokenFromRequest(request, config);
  await repository.revokeSession(token).catch(() => {});
  return responseJson({ ok: true, authenticated: false }, 200, { "Set-Cookie": sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 }) });
}

async function handleResource(request, config, repository, dependencies) {
  if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const authentication = await requirePrincipal(request, config, repository);
  if (authentication.demo) return responseJson({ error: "demo_resource_forbidden" }, 403);
  const file = new URL(request.url).searchParams.get("file");
  if (!new Set(["guide", "workbook"]).has(file)) return responseJson({ error: "invalid_file" }, 400);
  const pathname = file === "guide" ? config.guidePathname : config.workbookPathname;
  const filename = file === "guide" ? "Importa-tu-primer-coche-Guia-2026.pdf" : "Importa-tu-primer-coche-Cuaderno-2026.pdf";
  const blobOptions = academyPrivateBlobOptions(config, pathname, { ifNoneMatch: request.headers.get("if-none-match") || undefined });
  const result = await dependencies.blobGet(blobOptions.pathname, academyBlobSdkOptions(blobOptions));
  if (!result) return responseJson({ error: "file_not_found" }, 404);
  if (result.statusCode === 304) return new Response(null, { status: 304, headers: securityHeaders({ ETag: result.blob.etag, "Cache-Control": "private, no-cache" }) });
  if (result.statusCode !== 200) return responseJson({ error: "file_not_found" }, 404);
  return new Response(result.stream, { headers: securityHeaders({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    ETag: result.blob.etag,
  }) });
}

async function handlePage(request, config, repository) {
  if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  const route = safeRoute(new URL(request.url).searchParams.get("route"));
  const authentication = await authenticate(request, config, repository);
  if (!authentication?.principal) {
    const access = new URL("/academia/acceso/", config.baseUrl);
    access.searchParams.set("returnTo", route);
    return responseRedirect(`${access.pathname}${access.search}`, 303, authentication?.invalid ? { "Set-Cookie": sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 }) } : {});
  }
  return responseHtml(academyShell({ route }));
}

export function resolveAcademyAction(request) {
  return new URL(request.url).searchParams.get("action") || "";
}

export function createAcademyHandler({
  env = process.env,
  fetchImpl = fetch,
  blobGet = getPrivateBlob,
  now = () => Date.now(),
  randomCode = randomSixDigitCode,
  randomToken = randomOpaqueToken,
  contentLoader = privateProgram,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  authRequestMinimumMs = 800,
} = {}) {
  const config = academyConfigFromEnv(env);
  const repository = createAcademyRepository(config, fetchImpl);
  const dependencies = { fetchImpl, blobGet, randomCode, randomToken, contentLoader, sleep, authRequestMinimumMs, nowSeconds: () => Math.floor(now() / 1000) };
  return async function handler(request) {
    const action = resolveAcademyAction(request);
    try {
      if (action === "auth-request") return await handleAuthRequest(request, config, repository, dependencies);
      if (action === "auth-verify") return await handleAuthVerify(request, config, repository, dependencies);
      if (action === "auth-magic") return responseJson({ error: "not_found" }, 404);
      if (action === "demo") return await handleDemo(request, config, repository, dependencies);
      if (action === "admin-entitlement") return await handleAdminEntitlement(request, config, repository);
      if (action === "session") return await handleSession(request, config, repository, dependencies);
      if (action === "program") return await handleProgram(request, config, repository, dependencies);
      if (action === "state") return await handleState(request, config, repository);
      if (action === "logout") return await handleLogout(request, config, repository);
      if (action === "resource") return await handleResource(request, config, repository, dependencies);
      if (action === "page") return await handlePage(request, config, repository);
      return responseJson({ error: "not_found" }, 404);
    } catch (error) {
      const status = Number(error?.status) || 503;
      const retryAfter = Number(error?.retryAfter || 0);
      const headers = {};
      if (retryAfter) headers["Retry-After"] = String(retryAfter);
      if (error?.clearCookie) headers["Set-Cookie"] = sessionCookie("", { vercelEnv: config.vercelEnv, maxAge: 0 });
      if (status >= 500) logAcademy("academy_api_error", { action, reason: safeError(error).slice(0, 100) });
      const code = status === 429 ? "rate_limited" : status === 403 ? safeError(error) : status === 401 ? "unauthorized" : status === 400 || status === 413 ? safeError(error) : "service_unavailable";
      return responseJson({ error: code, message: status === 429 ? "Espera un momento antes de volver a intentarlo." : code, ...(retryAfter ? { retry_after: retryAfter } : {}) }, status, headers);
    }
  };
}

const handler = createAcademyHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
