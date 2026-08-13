import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAcademyHandler, resolveAcademyAction } from "../api/academy.js";
import { privateProgram } from "../api/_academy/content.js";
import { academyConfigFromEnv, createAcademyRepository, grantAcademyEntitlementForPurchase } from "../api/_academy/repository.js";
import {
  academyCookieName,
  emailHash,
  normalizeEmail,
  safeReturnTo,
  sessionCookie,
  validateAcademyState,
} from "../api/_academy/security.js";

function json(body, status = 200) {
  return Response.json(body, { status });
}

function academyEnv(overrides = {}) {
  return {
    ACADEMY_REDIS_REST_URL: "https://academy-redis.example.test",
    ACADEMY_REDIS_REST_TOKEN: "academy-redis-token",
    ACADEMY_AUTH_SECRET: "a".repeat(48),
    ACADEMY_DATA_SECRET: "d".repeat(48),
    ACADEMY_SESSION_SECRET: "s".repeat(48),
    ACADEMY_ADMIN_API_TOKEN: "admin-server-token-".padEnd(48, "y"),
    ACADEMY_DEMO_TOKEN: "demo-server-token-".padEnd(48, "x"),
    ACADEMY_DEMO_SESSION_TTL_SECONDS: "3600",
    ACADEMY_FROM_EMAIL: "Academia <academia@example.com>",
    RESEND_API_KEY: "resend-placeholder",
    IMPORTA_7_DIAS_BASE_URL: "https://ivanimports.es",
    ACADEMY_CONTENT_BLOB_PATHNAME: "academy/production/program-v2.json",
    IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME: "academy/production/importa-tu-coche-en-7-dias-guia-2026.pdf",
    IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME: "academy/production/importa-tu-coche-en-7-dias-cuaderno.pdf",
    ACADEMY_PRODUCTION_BLOB_STORE_ID: "store-production-test",
    ACADEMY_PRODUCTION_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store-production-test_secret",
    VERCEL_OIDC_TOKEN: "opaque-oidc-production-test-value",
    IMPORTA_7_DIAS_SUPPORT_PHONE_E164: "+34600000000",
    VERCEL_ENV: "production",
    ...overrides,
  };
}

test("los fuentes backend de Academia permanecen en UTF-8 sin mojibake", async () => {
  const files = [
    "../api/academy.js",
    "../api/_academy/content.js",
    "../api/_academy/repository.js",
    "../api/_academy/security.js",
    "../api/_academy/shell.js",
    "../api/importa-7-dias.js",
  ];
  const mojibake = /\u00c3|\u00c2|\u00e2[\u0080-\u00bf]|\u00ce/;
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, mojibake, file);
  }
});

test("development prefiere el ensamblado privado v2 y conserva fallback local v1", async () => {
  const minimumProgram = (schemaVersion) => JSON.stringify({
    schemaVersion,
    id: "importa-tu-primer-coche",
    title: `Programa v${schemaVersion}`,
    stages: [],
    lessons: [],
    tools: [],
    resources: [],
    glossary: [],
  });
  const preferredCalls = [];
  const preferred = await privateProgram({
    config: { vercelEnv: "development" },
    localRead: async (path) => {
      preferredCalls.push(path);
      return minimumProgram(2);
    },
  });
  assert.equal(preferred.schemaVersion, 2);
  assert.match(preferredCalls[0], /academy[\\/]v2[\\/]dist[\\/]program-v2\.json$/);

  const fallbackCalls = [];
  const fallback = await privateProgram({
    config: { vercelEnv: "development" },
    localRead: async (path) => {
      fallbackCalls.push(path);
      if (fallbackCalls.length === 1) throw Object.assign(new Error("missing v2"), { code: "ENOENT" });
      return minimumProgram(1);
    },
  });
  assert.equal(fallback.schemaVersion, 1);
  assert.equal(fallbackCalls.length, 2);
  assert.match(fallbackCalls[1], /academy[\\/]program-2026\.json$/);
});

function createMemoryService() {
  const redis = new Map();
  const expiry = new Map();
  const commands = [];
  const emails = [];

  const clean = (key) => {
    if (expiry.has(key) && expiry.get(key) <= Date.now()) {
      expiry.delete(key);
      redis.delete(key);
    }
  };

  const redisCommand = (command) => {
    commands.push(command);
    const operation = String(command[0]).toUpperCase();
    if (operation === "GET") {
      clean(command[1]);
      return redis.get(command[1]) ?? null;
    }
    if (operation === "GETDEL") {
      clean(command[1]);
      const value = redis.get(command[1]) ?? null;
      redis.delete(command[1]);
      expiry.delete(command[1]);
      return value;
    }
    if (operation === "SET") {
      const key = command[1];
      clean(key);
      if (command.includes("NX") && redis.has(key)) return null;
      redis.set(key, String(command[2]));
      const exIndex = command.indexOf("EX");
      if (exIndex >= 0) expiry.set(key, Date.now() + Number(command[exIndex + 1]) * 1000);
      else expiry.delete(key);
      return "OK";
    }
    if (operation === "DEL") {
      let deleted = 0;
      for (const key of command.slice(1)) {
        if (redis.delete(key)) deleted += 1;
        expiry.delete(key);
      }
      return deleted;
    }
    if (operation === "INCR") {
      clean(command[1]);
      const value = Number(redis.get(command[1]) || 0) + 1;
      redis.set(command[1], String(value));
      return value;
    }
    if (operation === "SADD") {
      const members = redis.get(command[1]) instanceof Set ? redis.get(command[1]) : new Set();
      let added = 0;
      for (const member of command.slice(2)) {
        if (!members.has(member)) added += 1;
        members.add(member);
      }
      redis.set(command[1], members);
      return added;
    }
    if (operation === "SREM") {
      const members = redis.get(command[1]);
      if (!(members instanceof Set)) return 0;
      let removed = 0;
      for (const member of command.slice(2)) if (members.delete(member)) removed += 1;
      return removed;
    }
    if (operation === "SMEMBERS") {
      const members = redis.get(command[1]);
      return members instanceof Set ? [...members] : [];
    }
    if (operation === "EXPIRE") {
      if (!redis.has(command[1])) return 0;
      expiry.set(command[1], Date.now() + Number(command[2]) * 1000);
      return 1;
    }
    if (operation === "TTL") {
      clean(command[1]);
      if (!redis.has(command[1])) return -2;
      if (!expiry.has(command[1])) return -1;
      return Math.max(0, Math.ceil((expiry.get(command[1]) - Date.now()) / 1000));
    }
    if (operation === "EVAL") {
      const script = command[1];
      const key = command[3];
      if (script.includes("nextRevision")) {
        const current = redis.has(key) ? JSON.parse(redis.get(key)) : { revision: 0 };
        const expected = command[4];
        if (expected !== "" && Number(expected) !== Number(current.revision || 0)) return [0, Number(current.revision || 0)];
        const record = { state: JSON.parse(command[5]), revision: Number(current.revision || 0) + 1, updatedAt: command[7] };
        redis.set(key, JSON.stringify(record));
        expiry.set(key, Date.now() + Number(command[6]) * 1000);
        return [1, record.revision, JSON.stringify(record)];
      }
      const expected = command[4];
      if (redis.get(key) === expected) {
        redis.delete(key);
        expiry.delete(key);
        return 1;
      }
      return 0;
    }
    throw new Error(`Unsupported Redis command: ${operation}`);
  };

  const fetchImpl = async (url, options = {}) => {
    if (String(url) === "https://academy-redis.example.test") return json({ result: redisCommand(JSON.parse(options.body)) });
    if (String(url) === "https://api.resend.com/emails") {
      emails.push({ payload: JSON.parse(options.body), headers: options.headers });
      return json({ id: `email-${emails.length}` });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  return { redis, expiry, commands, emails, fetchImpl };
}

async function seedEntitlement(service, env, email = "Buyer@Example.com", overrides = {}) {
  const config = academyConfigFromEnv(env);
  const repository = createAcademyRepository(config, service.fetchImpl);
  const subject = emailHash(email, config.dataSecret);
  await repository.grantEntitlement({
    subject,
    sourceSessionId: overrides.sessionId || "cs_live_1234567890abcdef",
    purchasedAt: "2026-08-11T10:00:00.000Z",
    bonusEligible: overrides.bonusEligible ?? true,
    supportExpiresAt: overrides.supportExpiresAt || "2026-08-25T10:00:00.000Z",
  });
  return { config, repository, subject };
}

function post(path, body, { origin = "https://ivanimports.es", cookie = "" } = {}) {
  const headers = { "Content-Type": "application/json", Origin: origin };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://ivanimports.es/api/academy?action=${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

function get(path, { cookie = "", authorization = "" } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (authorization) headers.Authorization = authorization;
  return new Request(`https://ivanimports.es/api/academy?action=${path}`, { headers });
}

function cookiePair(response) {
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

test("normaliza y hashea email sin conservarlo en la identidad", () => {
  assert.equal(normalizeEmail("  Buyer@EXAMPLE.com "), "buyer@example.com");
  assert.equal(normalizeEmail("bad@@example.com"), "");
  const digest = emailHash("Buyer@example.com", "d".repeat(48));
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest.includes("buyer"), false);
});

test("preview usa cookie __Host-Secure y aplica CSRF por origen", async () => {
  assert.equal(academyCookieName("preview"), "__Host-ivan_academia");
  assert.match(sessionCookie("opaque", { vercelEnv: "preview", maxAge: 60 }), /^__Host-ivan_academia=.*;.*Secure/);
  assert.equal(academyCookieName("development"), "ivan_academia");
  const service = createMemoryService();
  const handler = createAcademyHandler({ env: academyEnv({ VERCEL_ENV: "preview" }), fetchImpl: service.fetchImpl, authRequestMinimumMs: 0 });
  const wrongOrigin = new Request("https://preview.example.test/api/academy?action=auth-request", {
    method: "POST",
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com" }),
  });
  assert.equal((await handler(wrongOrigin)).status, 403);
  const previewOrigin = new Request("https://preview.example.test/api/academy?action=auth-request", {
    method: "POST",
    headers: { Origin: "https://preview.example.test", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com" }),
  });
  assert.equal((await handler(previewOrigin)).status, 202);
});

test("returnTo usa una allowlist explícita y bloquea open redirects y acceso", () => {
  for (const value of ["/academia/importa-tu-primer-coche/", "/academia/importa-tu-primer-coche/modulo/uno", "/academia/cuenta", "/ruta", "/etapa/documentacion", "/paso/3?tab=check", "/mi-operacion", "/candidatos", "/herramientas", "/herramientas/", "/herramientas/calculadora", "/respuestas", "/recursos", "/soporte"]) {
    assert.equal(safeReturnTo(value), value);
  }
  for (const value of ["https://evil.example/academia", "//evil.example/path", "/academia/acceso/", "/api/academy", "/otro", "\\evil.example\\x"]) {
    assert.equal(safeReturnTo(value), "/academia/importa-tu-primer-coche/");
  }
});

test("resolveAcademyAction conserva el contrato exacto", () => {
  assert.equal(resolveAcademyAction(new Request("https://ivanimports.es/api/academy?action=auth-request")), "auth-request");
  assert.equal(resolveAcademyAction(new Request("https://ivanimports.es/api/academy?action=demo")), "demo");
  assert.equal(resolveAcademyAction(new Request("https://ivanimports.es/api/academy?action=admin-entitlement")), "admin-entitlement");
  assert.equal(resolveAcademyAction(new Request("https://ivanimports.es/api/academy")), "");
});

test("valida las secciones y los límites del estado privado", () => {
  const state = validateAcademyState({ progress: { intro: { completed: true } }, operation: { budget: 20_000 }, candidates: [{ id: "a", model: "BMW" }], tools: { calculator: { tax: 200 } } });
  assert.equal(state.progress.intro.completed, true);
  assert.throws(() => validateAcademyState({ unknown: {} }), /invalid_state_section/);
  assert.throws(() => validateAcademyState({ candidates: Array.from({ length: 21 }, (_, id) => ({ id })) }), /too_many_candidates/);
  assert.throws(() => validateAcademyState({ progress: { note: "x".repeat(5_001) } }), /state_string_too_long/);
  const completedLessonIds = Array.from({ length: 317 }, (_, index) => `lesson-${index + 1}`);
  const fullProgress = validateAcademyState({ progress: { completedLessonIds: [...completedLessonIds, "lesson-1"] } });
  assert.equal(fullProgress.progress.completedLessonIds.length, 317);
  assert.throws(() => validateAcademyState({ progress: { completedLessonIds: [null] } }), /invalid_progress_id/);
  const lessonChecklists = Object.fromEntries(completedLessonIds.map((lessonId) => [lessonId, { first: true, second: false }]));
  const largeState = validateAcademyState({
    version: 1,
    progress: { completedLessonIds },
    operation: { title: "Operación completa" },
    candidates: Array.from({ length: 20 }, (_, index) => ({ id: `candidate-${index}`, model: `Modelo ${index}` })),
    tools: { lessonChecklists, budget: { purchase: 20_000 }, notes: ["uno", "dos"] },
  });
  assert.equal(Object.keys(largeState.tools.lessonChecklists).length, 317);
  assert.throws(() => validateAcademyState({ tools: { lessonChecklists: Object.fromEntries(Array.from({ length: 401 }, (_, index) => [`lesson-${index}`, {}])) } }), /state_object_too_large/);
  assert.throws(() => validateAcademyState({ tools: { values: Array.from({ length: 101 }, (_, index) => index) } }), /state_array_too_long/);
});

test("el entitlement es idempotente, persistente y no reduce el bonus existente", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  const { repository, subject } = await seedEntitlement(service, env);
  const second = await repository.grantEntitlement({
    subject,
    sourceSessionId: "cs_live_fedcba0987654321",
    purchasedAt: "2026-08-12T10:00:00.000Z",
    bonusEligible: false,
    supportExpiresAt: "",
  });
  assert.equal(second.status, "active");
  assert.equal(second.bonusEligible, true);
  assert.equal(second.supportExpiresAt, "2026-08-25T10:00:00.000Z");
  const entitlementSet = service.commands.filter((command) => command[0] === "SET" && String(command[1]).includes(":entitlement:"));
  assert.equal(entitlementSet.at(-1).includes("EX"), false, "el acceso comprado no debe caducar silenciosamente");
});

test("auth request es neutral; código y magic link son de un uso; cookie segura y logout revoca", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  await seedEntitlement(service, env);
  const handler = createAcademyHandler({
    env,
    fetchImpl: service.fetchImpl,
    randomCode: () => "123456",
    randomToken: () => "m".repeat(43),
    now: () => Date.parse("2026-08-12T10:00:00.000Z"),
    authRequestMinimumMs: 0,
  });

  const unknown = await handler(post("auth-request", { email: "unknown@example.com", returnTo: "/ruta" }));
  const known = await handler(post("auth-request", { email: "buyer@example.com", returnTo: "/ruta" }));
  assert.equal(unknown.status, 202);
  assert.deepEqual(await unknown.json(), await known.clone().json());
  assert.equal(JSON.stringify(await known.json()).includes("eligible"), false);
  assert.equal(service.emails.length, 1);

  const wrong = await handler(post("auth-verify", { email: "buyer@example.com", code: "000000" }));
  assert.equal(wrong.status, 401);
  const verified = await handler(post("auth-verify", { email: "buyer@example.com", code: "123456" }));
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).redirectTo, "/ruta");
  const setCookie = verified.headers.get("set-cookie");
  assert.match(setCookie, /^__Host-ivan_academia=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = cookiePair(verified);

  const replay = await handler(post("auth-verify", { email: "buyer@example.com", code: "123456" }));
  assert.equal(replay.status, 401);

  const session = await handler(get("session", { cookie }));
  const sessionBody = await session.clone().json();
  assert.equal(sessionBody.authenticated, true);
  assert.equal(sessionBody.support.status, "active");
  assert.equal(sessionBody.support.url, "https://wa.me/34600000000");
  const rotatedCookie = cookiePair(session);
  assert.notEqual(rotatedCookie, cookie);
  const oldSession = await handler(get("session", { cookie }));
  assert.equal((await oldSession.json()).authenticated, false);

  const loggedOut = await handler(post("logout", {}, { cookie: rotatedCookie }));
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);

  const emailText = service.emails.at(-1).payload.text;
  assert.match(emailText, /123456/);
  assert.equal(emailText.includes("token="), false);
  assert.equal(emailText.includes("Enlace privado:"), false);
  assert.equal((await handler(new Request("https://ivanimports.es/api/academy?action=auth-magic&token=legacy"))).status, 404);
});

test("rate limits email/IP devuelven 429 sin revelar entitlement", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  await seedEntitlement(service, env);
  const handler = createAcademyHandler({ env, fetchImpl: service.fetchImpl, randomCode: () => "123456", randomToken: () => "t".repeat(43), authRequestMinimumMs: 0 });
  assert.equal((await handler(post("auth-request", { email: "buyer@example.com" }))).status, 202);
  const limited = await handler(post("auth-request", { email: "buyer@example.com" }));
  assert.equal(limited.status, 429);
  const payload = await limited.json();
  assert.equal(payload.error, "rate_limited");
  assert.equal("eligible" in payload, false);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("seis códigos erróneos invalidan el desafío y Redis nunca guarda código/token en claro", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  await seedEntitlement(service, env);
  const magicToken = "q".repeat(43);
  const handler = createAcademyHandler({ env, fetchImpl: service.fetchImpl, randomCode: () => "777777", randomToken: () => magicToken, authRequestMinimumMs: 0 });
  await handler(post("auth-request", { email: "buyer@example.com" }));
  const redisSnapshot = JSON.stringify([...service.redis.entries()]);
  assert.equal(redisSnapshot.includes("777777"), false);
  assert.equal(redisSnapshot.includes(magicToken), false);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    assert.equal((await handler(post("auth-verify", { email: "buyer@example.com", code: String(attempt).padStart(6, "0") }))).status, 401);
  }
  assert.equal((await handler(post("auth-verify", { email: "buyer@example.com", code: "777777" }))).status, 401);
});

test("admin entitlement exige Bearer, concede idempotente, revoca sesiones y reactiva sin PII en logs", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  const handler = createAcademyHandler({
    env,
    fetchImpl: service.fetchImpl,
    randomCode: () => "424242",
    randomToken: () => "q".repeat(43),
    authRequestMinimumMs: 0,
  });
  const payload = { action: "grant-entitlement", programId: "importa-tu-primer-coche", email: "Buyer@Example.com", source: "manual-admin" };
  const adminRequest = (body, token = env.ACADEMY_ADMIN_API_TOKEN) => new Request("https://ivanimports.es/api/academy?action=admin-entitlement", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal((await handler(adminRequest(payload, "wrong"))).status, 401);

  const originalInfo = console.info;
  const logs = [];
  console.info = (...values) => logs.push(values.join(" "));
  try {
    const granted = await handler(adminRequest(payload));
    assert.equal(granted.status, 200);
    assert.equal((await granted.json()).duplicate, false);
    const repeated = await handler(adminRequest(payload));
    assert.equal((await repeated.json()).unchanged, true);

    await handler(post("auth-request", { email: "buyer@example.com" }));
    const verified = await handler(post("auth-verify", { email: "buyer@example.com", code: "424242" }));
    const cookie = cookiePair(verified);
    assert.ok(cookie);

    const revoked = await handler(adminRequest({ action: "revoke-entitlement", programId: "importa-tu-primer-coche", email: "buyer@example.com", reason: "refund" }));
    const revokedBody = await revoked.json();
    assert.equal(revokedBody.status, "revoked");
    assert.ok(revokedBody.sessions_revoked >= 1);
    assert.equal((await (await handler(get("session", { cookie }))).json()).authenticated, false);
    const webhookReplay = await grantAcademyEntitlementForPurchase({
      email: "buyer@example.com",
      sessionId: "cs_live_replayed_purchase",
      purchasedAt: "2026-08-11T10:00:00.000Z",
      bonusEligible: true,
      supportExpiresAt: "2026-08-25T10:00:00.000Z",
      config: academyConfigFromEnv(env),
      fetchImpl: service.fetchImpl,
    });
    assert.equal(webhookReplay.status, "revoked", "un webhook repetido no debe deshacer una revocación explícita");

    const reactivated = await handler(adminRequest(payload));
    assert.equal((await reactivated.json()).reactivated, true);
  } finally {
    console.info = originalInfo;
  }
  const logText = logs.join("\n");
  assert.equal(logText.includes(env.ACADEMY_ADMIN_API_TOKEN), false);
  assert.equal(logText.includes("buyer@example.com"), false);
  assert.match(logText, /academy_admin_entitlement_revoked/);
});

test("demo canjea Bearer por cookie corta sin query y nunca abre contenido, estado o Blob reales", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  let contentCalls = 0;
  let blobCalls = 0;
  const handler = createAcademyHandler({
    env,
    fetchImpl: service.fetchImpl,
    contentLoader: async () => { contentCalls += 1; return { id: "should-not-load" }; },
    blobGet: async () => { blobCalls += 1; return null; },
  });
  const queryOnly = new Request("https://ivanimports.es/api/academy?action=demo&token=not-accepted", { method: "POST" });
  assert.equal((await handler(queryOnly)).status, 401);
  const exchangeRequest = new Request("https://ivanimports.es/api/academy?action=demo", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ACADEMY_DEMO_TOKEN}` },
  });
  assert.equal(exchangeRequest.url.includes(env.ACADEMY_DEMO_TOKEN), false);
  const exchange = await handler(exchangeRequest);
  assert.equal(exchange.status, 200);
  const cookie = cookiePair(exchange);
  assert.match(exchange.headers.get("set-cookie"), /HttpOnly/);
  assert.match(exchange.headers.get("set-cookie"), /Max-Age=3600/);

  assert.equal((await handler(new Request("https://ivanimports.es/api/academy?action=page&route=/ruta", { headers: { Cookie: cookie } }))).status, 200);
  const program = await (await handler(get("program", { cookie }))).json();
  assert.equal(program.entitlement.status, "demo");
  assert.equal(program.program.stages.length, 13);
  assert.equal(program.program.lessons.length, 13);
  assert.equal(program.program.stages[0].kind, "prologue");
  assert.equal(program.program.stages[0].countsTowardProgress, false);
  assert.equal(program.program.stages.filter((stage) => stage.countsTowardProgress !== false).length, 12);
  assert.equal(program.program.lessons.filter((lesson) => lesson.countsTowardProgress !== false).length, 12);
  assert.ok(program.program.lessons[0].blocks[0].body.length > 20);
  assert.equal(contentCalls, 0);
  const state = await (await handler(get("state", { cookie }))).json();
  assert.equal(state.revision, 0);
  const stateWrite = await handler(new Request("https://ivanimports.es/api/academy?action=state", {
    method: "PUT",
    headers: { Origin: "https://ivanimports.es", Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ state: { progress: {} }, revision: 0 }),
  }));
  assert.equal(stateWrite.status, 403);
  assert.equal((await handler(new Request("https://ivanimports.es/api/academy?action=resource&file=guide", { headers: { Cookie: cookie } }))).status, 403);
  assert.equal(blobCalls, 0);
});

test("programa, estado CAS, página y Blob exigen sesión+entitlement; demo no descarga", async () => {
  const service = createMemoryService();
  const env = academyEnv();
  await seedEntitlement(service, env);
  let blobCalls = 0;
  const handler = createAcademyHandler({
    env,
    fetchImpl: service.fetchImpl,
    randomCode: () => "654321",
    randomToken: () => "z".repeat(43),
    authRequestMinimumMs: 0,
    contentLoader: async () => ({ id: "importa-tu-primer-coche", title: "Privado", stages: [], lessons: [{ id: "l1", body: "Contenido" }], tools: [], resources: [], glossary: [] }),
    blobGet: async (pathname, options) => {
      blobCalls += 1;
      assert.equal(options.access, "private");
      assert.equal(options.storeId, "store-production-test");
      assert.equal(options.oidcToken, "opaque-oidc-production-test-value");
      assert.equal(Object.hasOwn(options, "token"), false);
      return { statusCode: 200, stream: new Blob(["%PDF-academy"]).stream(), blob: { etag: "academy-etag" }, pathname };
    },
  });
  await handler(post("auth-request", { email: "buyer@example.com" }));
  const verified = await handler(post("auth-verify", { email: "buyer@example.com", code: "654321" }));
  const cookie = cookiePair(verified);

  const anonymousProgram = await handler(get("program"));
  assert.equal(anonymousProgram.status, 401);
  const program = await handler(get("program", { cookie }));
  assert.equal((await program.json()).program.lessons[0].body, "Contenido");

  const initial = await handler(get("state", { cookie }));
  assert.equal((await initial.json()).revision, 0);
  const saved = await handler(new Request("https://ivanimports.es/api/academy?action=state", {
    method: "PUT",
    headers: { Origin: "https://ivanimports.es", Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 0, state: { version: 1, progress: { l1: { completed: true } }, operation: {}, candidates: [], tools: {} } }),
  }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.clone().json()).revision, 1);
  const conflict = await handler(new Request("https://ivanimports.es/api/academy?action=state", {
    method: "PUT",
    headers: { Origin: "https://ivanimports.es", Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 0, state: { version: 1, progress: {}, operation: {}, candidates: [], tools: {} } }),
  }));
  assert.equal(conflict.status, 409);
  const completedLessonIds = Array.from({ length: 317 }, (_, index) => `lesson-${index + 1}`);
  const lessonChecklists = Object.fromEntries(completedLessonIds.map((lessonId) => [lessonId, { first: true, second: false }]));
  const largeSave = await handler(new Request("https://ivanimports.es/api/academy?action=state", {
    method: "PUT",
    headers: { Origin: "https://ivanimports.es", Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ revision: 1, state: { version: 1, progress: { completedLessonIds }, operation: {}, candidates: Array.from({ length: 20 }, (_, index) => ({ id: `candidate-${index}` })), tools: { lessonChecklists } } }),
  }));
  assert.equal(largeSave.status, 200);
  assert.equal((await largeSave.json()).revision, 2);

  const resource = await handler(new Request("https://ivanimports.es/api/academy?action=resource&file=guide", { headers: { Cookie: cookie } }));
  assert.equal(resource.status, 200);
  assert.equal(Buffer.from(await resource.arrayBuffer()).toString(), "%PDF-academy");
  const demo = await handler(new Request("https://ivanimports.es/api/academy?action=resource&file=guide", { headers: { Authorization: `Bearer ${env.ACADEMY_DEMO_TOKEN}` } }));
  assert.equal(demo.status, 403);
  assert.equal(blobCalls, 1);

  const pageRedirect = await handler(new Request("https://ivanimports.es/api/academy?action=page&route=https://evil.example"));
  assert.equal(pageRedirect.status, 303);
  assert.equal(pageRedirect.headers.get("location"), "/academia/acceso/?returnTo=%2Facademia%2Fimporta-tu-primer-coche%2F");
  const page = await handler(new Request("https://ivanimports.es/api/academy?action=page&route=/ruta", { headers: { Cookie: cookie } }));
  assert.equal(page.status, 200);
  const csp = page.headers.get("content-security-policy");
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.equal(csp.split(";").find((directive) => directive.trim().startsWith("script-src")).trim(), "script-src 'self'");
  const html = await page.text();
  assert.match(html, /data-academy-app/);
  assert.match(html, /<div id="academy-app"/);
  assert.doesNotMatch(html, /<main id="academy-app"/);
  assert.match(html, /href="#academy-app"/);
  assert.match(html, /assets\/academy\/app\.js/);
  assert.doesNotMatch(html, /Contenido/);
});
