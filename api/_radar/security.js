import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const SKEW = 60;

export function radarConfigFromEnv(env = process.env) {
  const list = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return {
    clientId: String(env.RADAR_GOOGLE_CLIENT_ID || "").trim(),
    adminSubs: list(env.RADAR_ADMIN_GOOGLE_SUBS),
    sessionSecret: String(env.RADAR_SESSION_SECRET || ""),
    sessionTtl: Math.min(Math.max(Number(env.RADAR_SESSION_TTL_SECONDS) || 8 * 3600, 900), 24 * 3600),
    redisUrl: String(env.RADAR_REDIS_REST_URL || env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, ""),
    redisToken: String(env.RADAR_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || ""),
    allowedOrigins: list(env.RADAR_ALLOWED_ORIGINS),
    vercelEnv: String(env.VERCEL_ENV || "development"),
    environment: radarEnvironment(env.VERCEL_ENV),
  };
}

/** Preview y Producción nunca comparten datos aunque usen el mismo Redis o Blob: cada entorno tiene su propio prefijo. */
export function radarEnvironment(vercelEnv) {
  const value = String(vercelEnv || "development");
  return value === "production" ? "production" : value === "preview" ? "preview" : "development";
}

/** Nombres de variables ausentes (nunca valores). */
export function missingConfig(config) {
  const missing = [];
  if (!config.clientId) missing.push("RADAR_GOOGLE_CLIENT_ID");
  if (config.sessionSecret.length < 32) missing.push("RADAR_SESSION_SECRET (mínimo 32 caracteres)");
  if (!config.redisUrl || !config.redisToken) missing.push("RADAR_REDIS_REST_URL/TOKEN (o UPSTASH_*/KV_*)");
  return missing;
}

export function constantTimeEqual(a, b) {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y) && String(a).length === String(b).length;
}

export const b64u = (buffer) => Buffer.from(buffer).toString("base64url");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hmac = (secret, value) => createHmac("sha256", secret).update(String(value)).digest("base64url");

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* cookie inválida */ }
  }
  return out;
}

const secureEnv = (vercelEnv) => !["development", "test"].includes(String(vercelEnv || "development"));
export const sessionCookieName = (vercelEnv) => (secureEnv(vercelEnv) ? "__Host-radar_admin" : "radar_admin");
export const nonceCookieName = (vercelEnv) => (secureEnv(vercelEnv) ? "__Host-radar_nonce" : "radar_nonce");

export function buildCookie(name, value, { vercelEnv, maxAge }) {
  const parts = [`${name}=${encodeURIComponent(value || "")}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.max(0, Math.floor(maxAge))}`];
  if (secureEnv(vercelEnv)) parts.push("Secure");
  return parts.join("; ");
}

/** Origen permitido: el propio host de la petición o los configurados. Sin Origin válido se rechaza. */
export function originAllowed(request, config) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const own = new URL(request.url).origin;
  return origin === own || config.allowedOrigins.includes(origin);
}

/* ---- Verificación de Google ID token (OIDC) sin dependencias externas ---- */
let jwksCache = { keys: null, expires: 0 };
export function resetJwksCache() { jwksCache = { keys: null, expires: 0 }; }

export async function loadGoogleJwks(fetchImpl = fetch, now = Date.now()) {
  if (jwksCache.keys && jwksCache.expires > now) return jwksCache.keys;
  const response = await fetchImpl(GOOGLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw Object.assign(new Error("jwks_unavailable"), { status: 503 });
  const body = await response.json();
  const maxAge = /max-age=(\d+)/.exec(response.headers?.get?.("cache-control") || "")?.[1];
  jwksCache = { keys: body.keys || [], expires: now + Math.min(Number(maxAge) || 3600, 86400) * 1000 };
  return jwksCache.keys;
}

export class AuthError extends Error {
  constructor(reason, status = 401) { super(reason); this.reason = reason; this.status = status; }
}

export async function verifyGoogleIdToken(token, { clientId, nonce, fetchImpl = fetch, now = Date.now() }) {
  if (typeof token !== "string" || token.length > 4096) throw new AuthError("bad_token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("bad_token");
  let header; let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { throw new AuthError("bad_token"); }
  if (header.alg !== "RS256" || !header.kid) throw new AuthError("bad_alg");
  const keys = await loadGoogleJwks(fetchImpl, now);
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new AuthError("unknown_key");
  const valid = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"));
  if (!valid) throw new AuthError("bad_signature");
  const seconds = Math.floor(now / 1000);
  if (!GOOGLE_ISSUERS.includes(claims.iss)) throw new AuthError("bad_issuer");
  if (!clientId || claims.aud !== clientId) throw new AuthError("bad_audience");
  if (!Number.isFinite(claims.exp) || claims.exp + SKEW < seconds) throw new AuthError("expired");
  if (Number.isFinite(claims.iat) && claims.iat - SKEW > seconds) throw new AuthError("bad_iat");
  if (!claims.sub || typeof claims.sub !== "string") throw new AuthError("no_sub");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new AuthError("email_unverified");
  if (!nonce || !claims.nonce || !constantTimeEqual(claims.nonce, nonce)) throw new AuthError("bad_nonce");
  return { sub: claims.sub, email: claims.email || "", name: claims.name || "" };
}

/** Modo de alta: no hay administradores autorizados todavía; el login solo revela el sub de quien entra. */
export const setupMode = (config) => config.adminSubs.length === 0;
export const isAuthorizedSub = (sub, config) => config.adminSubs.some((allowed) => constantTimeEqual(allowed, sub));
