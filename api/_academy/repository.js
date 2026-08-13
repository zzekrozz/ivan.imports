import {
  ACADEMY_PROGRAM_ID,
  emailHash,
  hmacDigest,
  randomOpaqueToken,
} from "./security.js";
import { academyBlobAccessFromEnv } from "./blob.js";

const FIVE_YEARS_SECONDS = 5 * 365 * 24 * 60 * 60;
const STATE_TTL_SECONDS = FIVE_YEARS_SECONDS;

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(String(value || "https://ivanimports.es"));
    return url.origin;
  } catch {
    return "https://ivanimports.es";
  }
}

export function academyConfigFromEnv(env = process.env) {
  return {
    ...academyBlobAccessFromEnv(env),
    redisUrl: String(env.ACADEMY_REDIS_REST_URL || env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, ""),
    redisToken: env.ACADEMY_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "",
    authSecret: env.ACADEMY_AUTH_SECRET || "",
    dataSecret: env.ACADEMY_DATA_SECRET || "",
    sessionSecret: env.ACADEMY_SESSION_SECRET || "",
    adminApiToken: env.ACADEMY_ADMIN_API_TOKEN || "",
    resendApiKey: env.RESEND_API_KEY || "",
    resendFrom: env.ACADEMY_FROM_EMAIL || env.RESEND_FROM_EMAIL || "",
    baseUrl: normalizeBaseUrl(env.ACADEMY_BASE_URL || env.IMPORTA_7_DIAS_BASE_URL),
    contentBlobPathname: env.ACADEMY_CONTENT_BLOB_PATHNAME || "",
    guidePathname: env.IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME || "products/importa-7-dias/2026/guia-principal.pdf",
    workbookPathname: env.IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME || "products/importa-7-dias/2026/cuaderno-de-trabajo.pdf",
    sessionTtl: boundedNumber(env.ACADEMY_SESSION_TTL_SECONDS, 30 * 24 * 60 * 60, 60 * 60, 365 * 24 * 60 * 60),
    demoSessionTtl: boundedNumber(env.ACADEMY_DEMO_SESSION_TTL_SECONDS, 60 * 60, 5 * 60, 4 * 60 * 60),
    codeTtl: boundedNumber(env.ACADEMY_CODE_TTL_SECONDS, 10 * 60, 5 * 60, 30 * 60),
    resendCooldown: boundedNumber(env.ACADEMY_RESEND_COOLDOWN_SECONDS, 60, 30, 5 * 60),
    demoToken: env.ACADEMY_DEMO_TOKEN || "",
    supportPhone: String(env.IMPORTA_7_DIAS_SUPPORT_PHONE_E164 || "").replace(/\D/g, "").slice(0, 15),
    vercelEnv: env.VERCEL_ENV || "development",
  };
}

export function academyGrantConfigured(config) {
  return Boolean(config?.redisUrl && config?.redisToken && String(config?.dataSecret || "").length >= 32);
}

export function academyAuthConfigured(config) {
  return academyGrantConfigured(config)
    && String(config?.authSecret || "").length >= 32
    && String(config?.sessionSecret || "").length >= 32
    && config?.resendApiKey
    && config?.resendFrom;
}

function parseJson(value) {
  if (!value) return null;
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
}

export class AcademyRepository {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async command(command) {
    if (!this.config.redisUrl || !this.config.redisToken) throw new Error("Academy Redis is not configured");
    const response = await this.fetchImpl(this.config.redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.redisToken}`,
        "Content-Type": "application/json",
        "User-Agent": "IvanImports-Academy/1.0",
      },
      body: JSON.stringify(command),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error || `Academy Redis command failed (${response.status})`);
    return body.result;
  }

  key(...parts) {
    return ["academy", "v1", ...parts].join(":");
  }

  async getJson(key) {
    return parseJson(await this.command(["GET", key]));
  }

  async setJson(key, value, ttl = FIVE_YEARS_SECONDS, { onlyIfMissing = false } = {}) {
    const command = ["SET", key, JSON.stringify(value)];
    if (ttl !== null) command.push("EX", String(ttl));
    if (onlyIfMissing) command.push("NX");
    return this.command(command);
  }

  async deleteKeys(...keys) {
    const filtered = keys.flat().filter(Boolean);
    if (!filtered.length) return 0;
    return this.command(["DEL", ...filtered]);
  }

  entitlementKey(subject) {
    return this.key("entitlement", subject, ACADEMY_PROGRAM_ID);
  }

  async getEntitlementRecord(subject) {
    return this.getJson(this.entitlementKey(subject));
  }

  async getEntitlement(subject) {
    const entitlement = await this.getEntitlementRecord(subject);
    return entitlement?.status === "active" && entitlement?.programId === ACADEMY_PROGRAM_ID ? entitlement : null;
  }

  async getEntitlementForEmail(email) {
    const subject = emailHash(email, this.config.dataSecret);
    return subject ? this.getEntitlement(subject) : null;
  }

  async grantEntitlement({ subject, sourceSessionId, purchasedAt, bonusEligible = false, supportExpiresAt = "", allowReactivation = false }) {
    if (!/^[a-f0-9]{64}$/.test(subject)) throw new Error("Invalid academy subject");
    const sourceDigest = hmacDigest(sourceSessionId, this.config.dataSecret, "academy-purchase-v1");
    const sourceKey = this.key("purchase", sourceDigest);
    const entitlementKey = this.entitlementKey(subject);
    const existingSource = await this.command(["GET", sourceKey]);
    if (existingSource && existingSource !== subject) throw new Error("Purchase is already linked to another identity");

    const now = new Date().toISOString();
    const existingRecord = await this.getEntitlementRecord(subject);
    if (existingRecord?.status === "revoked" && !allowReactivation) {
      const error = new Error("Academy entitlement is explicitly revoked");
      error.code = "academy_entitlement_revoked";
      throw error;
    }
    const existing = existingRecord?.status === "active" ? existingRecord : null;
    const previous = existingRecord?.programId === ACADEMY_PROGRAM_ID ? existingRecord : null;
    const entitlement = {
      status: "active",
      programId: ACADEMY_PROGRAM_ID,
      subject,
      sourceRef: String(sourceSessionId).slice(-8),
      purchasedAt: previous?.purchasedAt || purchasedAt || now,
      grantedAt: previous?.grantedAt || now,
      updatedAt: now,
      bonusEligible: Boolean(previous?.bonusEligible || bonusEligible),
      supportExpiresAt: previous?.supportExpiresAt || supportExpiresAt || "",
      ...(existingRecord?.status === "revoked" ? { reactivatedAt: now } : {}),
    };

    const sourceResult = await this.command(["SET", sourceKey, subject, "EX", String(FIVE_YEARS_SECONDS), "NX"]);
    if (!sourceResult && !existingSource) {
      const winner = await this.command(["GET", sourceKey]);
      if (winner !== subject) throw new Error("Unable to establish academy purchase identity");
    }
    // El acceso comprado no caduca silenciosamente; una revocación debe ser explícita.
    await this.setJson(entitlementKey, entitlement, null);
    const reactivated = existingRecord?.status === "revoked";
    return { ...entitlement, idempotent: Boolean(existing || existingSource) && !reactivated, reactivated };
  }

  async revokeEntitlement(subject, reason = "manual-admin") {
    if (!/^[a-f0-9]{64}$/.test(subject)) throw new Error("Invalid academy subject");
    const existing = await this.getEntitlementRecord(subject);
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      status: "revoked",
      programId: ACADEMY_PROGRAM_ID,
      subject,
      revokedAt: existing?.revokedAt || now,
      updatedAt: now,
      revocationReason: String(reason || "manual-admin").slice(0, 80),
    };
    await this.setJson(this.entitlementKey(subject), record, null);
    const sessionsRevoked = await this.revokeSessionsForSubject(subject);
    return { revoked: existing?.status === "active", unchanged: existing?.status === "revoked", sessionsRevoked };
  }

  activeChallengeKey(subject) {
    return this.key("auth", "active", subject);
  }

  attemptKey(subject) {
    return this.key("auth", "attempts", subject);
  }

  challengeStatusKey(subject) {
    return this.key("auth", "status", subject);
  }

  async invalidateActiveChallenge(subject) {
    const activeKey = this.activeChallengeKey(subject);
    const record = await this.getJson(activeKey);
    await this.deleteKeys(activeKey, this.attemptKey(subject), this.challengeStatusKey(subject), record?.codeKey, record?.gateKey);
  }

  async issueChallenge({ subject, codeDigest, emailMasked, returnTo, ttl, nowSeconds = Math.floor(Date.now() / 1000) }) {
    await this.invalidateActiveChallenge(subject);
    const challengeId = randomOpaqueToken(18);
    const codeKey = this.key("auth", "code", subject, codeDigest);
    const gateKey = this.key("auth", "gate", challengeId);
    const activeKey = this.activeChallengeKey(subject);
    const record = {
      challengeId,
      subject,
      purpose: "academy_login",
      emailMasked,
      returnTo,
      codeKey,
      gateKey,
      createdAt: nowSeconds,
      expiresAt: nowSeconds + ttl,
      status: "active",
    };
    await this.command(["SET", gateKey, "1", "EX", String(ttl), "NX"]);
    await this.setJson(codeKey, record, ttl, { onlyIfMissing: true });
    // Conservamos metadatos brevemente para distinguir un código caducado sin guardar el código real.
    await this.setJson(activeKey, record, ttl + 60 * 60);
    return record;
  }

  async registerAttempt(subject, maxAttempts, ttl) {
    const key = this.attemptKey(subject);
    const count = Number(await this.command(["INCR", key]));
    if (count === 1) await this.command(["EXPIRE", key, String(ttl)]);
    if (count > maxAttempts) await this.invalidateActiveChallenge(subject);
    return { allowed: count <= maxAttempts, count };
  }

  async consumeCode({ subject, codeDigest, maxAttempts = 5, ttl, nowSeconds = Math.floor(Date.now() / 1000) }) {
    const previousStatus = await this.getJson(this.challengeStatusKey(subject));
    if (previousStatus?.status === "used") return { status: "used" };
    if (previousStatus?.status === "expired") return { status: "expired" };
    if (previousStatus?.status === "locked") return { status: "locked" };
    const active = await this.getJson(this.activeChallengeKey(subject));
    if (active?.expiresAt && active.expiresAt <= nowSeconds) {
      await this.invalidateActiveChallenge(subject);
      await this.setJson(this.challengeStatusKey(subject), { status: "expired", purpose: "academy_login", at: nowSeconds }, 60 * 60);
      return { status: "expired" };
    }
    const attempt = await this.registerAttempt(subject, maxAttempts, ttl);
    if (!attempt.allowed) return { status: "locked" };
    const codeKey = this.key("auth", "code", subject, codeDigest);
    const record = parseJson(await this.command(["GETDEL", codeKey]));
    if (!record || record.subject !== subject) {
      if (attempt.count >= maxAttempts) {
        await this.invalidateActiveChallenge(subject);
        await this.setJson(this.challengeStatusKey(subject), { status: "locked", purpose: "academy_login", at: nowSeconds }, 60 * 60);
      }
      return { status: attempt.count >= maxAttempts ? "locked" : "invalid", attempts: attempt.count };
    }
    const gate = await this.command(["GETDEL", record.gateKey]);
    if (!gate) return { status: "used" };
    await this.deleteKeys(this.activeChallengeKey(subject), this.attemptKey(subject));
    await this.setJson(this.challengeStatusKey(subject), { status: "used", purpose: "academy_login", at: nowSeconds }, 60 * 60);
    return { status: "valid", record };
  }

  async rateLimit(scope, identifier, limit, windowSeconds) {
    const key = this.key("rate", scope, identifier);
    const count = Number(await this.command(["INCR", key]));
    if (count === 1) await this.command(["EXPIRE", key, String(windowSeconds)]);
    const ttl = Number(await this.command(["TTL", key]));
    return { allowed: count <= limit, count, retryAfter: Math.max(1, ttl > 0 ? ttl : windowSeconds) };
  }

  sessionKey(token) {
    return this.key("session", hmacDigest(token, this.config.sessionSecret, "academy-session-v1"));
  }

  sessionIndexKey(subject) {
    return this.key("sessions", subject);
  }

  async createSession({ subject, emailMasked, demo = false, ttl = this.config.sessionTtl, nowSeconds = Math.floor(Date.now() / 1000) }) {
    const token = randomOpaqueToken(32);
    const record = {
      subject,
      emailMasked,
      demo: Boolean(demo),
      createdAt: nowSeconds,
      rotatedAt: nowSeconds,
      expiresAt: nowSeconds + ttl,
    };
    const key = this.sessionKey(token);
    await this.setJson(key, record, ttl, { onlyIfMissing: true });
    await this.command(["SADD", this.sessionIndexKey(subject), key]);
    await this.command(["EXPIRE", this.sessionIndexKey(subject), String(Math.max(ttl, this.config.sessionTtl))]);
    return { token, record };
  }

  async getSession(token, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!token) return null;
    const record = await this.getJson(this.sessionKey(token));
    if (!record?.subject || !Number.isFinite(record.expiresAt) || record.expiresAt <= nowSeconds) {
      if (record) {
        await this.command(["SREM", this.sessionIndexKey(record.subject), this.sessionKey(token)]).catch(() => {});
        await this.deleteKeys(this.sessionKey(token));
      }
      return null;
    }
    return record;
  }

  async rotateSession(token, record, nowSeconds = Math.floor(Date.now() / 1000)) {
    const remaining = Math.max(60, Math.min(this.config.sessionTtl, record.expiresAt - nowSeconds));
    const replacement = await this.createSession({ subject: record.subject, emailMasked: record.emailMasked, demo: record.demo, ttl: remaining, nowSeconds });
    await this.revokeSession(token);
    return replacement;
  }

  async revokeSession(token) {
    if (!token) return 0;
    const key = this.sessionKey(token);
    const record = await this.getJson(key);
    if (record?.subject) await this.command(["SREM", this.sessionIndexKey(record.subject), key]).catch(() => {});
    return this.deleteKeys(key);
  }

  async revokeSessionsForSubject(subject) {
    const indexKey = this.sessionIndexKey(subject);
    const keys = await this.command(["SMEMBERS", indexKey]);
    const sessions = Array.isArray(keys) ? keys.filter((key) => typeof key === "string" && key.startsWith(this.key("session", ""))) : [];
    let revoked = 0;
    for (let index = 0; index < sessions.length; index += 100) {
      revoked += Number(await this.deleteKeys(sessions.slice(index, index + 100))) || 0;
    }
    await this.deleteKeys(indexKey);
    return revoked;
  }

  stateKey(subject) {
    return this.key("state", subject, ACADEMY_PROGRAM_ID);
  }

  async getState(subject) {
    const record = await this.getJson(this.stateKey(subject));
    return record && Number.isInteger(record.revision)
      ? record
      : { state: { version: 1, progress: {}, operation: {}, candidates: [], tools: {} }, revision: 0, updatedAt: null };
  }

  async putState(subject, state, expectedRevision) {
    const script = `
      local current = redis.call('get', KEYS[1])
      local revision = 0
      if current then
        local ok, decoded = pcall(cjson.decode, current)
        if ok and decoded.revision then revision = tonumber(decoded.revision) or 0 end
      end
      if ARGV[1] ~= '' and tonumber(ARGV[1]) ~= revision then return {0, revision} end
      local nextRevision = revision + 1
      local record = cjson.encode({ state = cjson.decode(ARGV[2]), revision = nextRevision, updatedAt = ARGV[4] })
      redis.call('set', KEYS[1], record, 'EX', ARGV[3])
      return {1, nextRevision, record}
    `;
    const expected = Number.isInteger(expectedRevision) && expectedRevision >= 0 ? String(expectedRevision) : "";
    const updatedAt = new Date().toISOString();
    const result = await this.command(["EVAL", script, "1", this.stateKey(subject), expected, JSON.stringify(state), String(STATE_TTL_SECONDS), updatedAt]);
    if (!Array.isArray(result) || Number(result[0]) !== 1) {
      return { conflict: true, revision: Number(result?.[1] || 0) };
    }
    return parseJson(result[2]) || { state, revision: Number(result[1]), updatedAt };
  }
}

export function createAcademyRepository(config, fetchImpl = fetch) {
  return new AcademyRepository(config, fetchImpl);
}

export async function grantAcademyEntitlementForPurchase({ email, sessionId, purchasedAt, bonusEligible, supportExpiresAt, config, fetchImpl = fetch }) {
  if (!academyGrantConfigured(config)) return { status: "skipped", reason: "not_configured" };
  const subject = emailHash(email, config.dataSecret);
  if (!subject) throw new Error("Paid purchase has no valid academy identity email");
  const repository = createAcademyRepository(config, fetchImpl);
  try {
    const entitlement = await repository.grantEntitlement({ subject, sourceSessionId: sessionId, purchasedAt, bonusEligible, supportExpiresAt });
    return { status: "active", entitlement };
  } catch (error) {
    if (error?.code === "academy_entitlement_revoked") return { status: "revoked" };
    throw error;
  }
}

export async function activeAcademyEntitlementForEmail(email, config, fetchImpl = fetch) {
  if (!academyGrantConfigured(config)) return null;
  return createAcademyRepository(config, fetchImpl).getEntitlementForEmail(email);
}
