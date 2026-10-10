import { generateKeyPairSync, sign } from "node:crypto";
import { createRadarHandler } from "../api/radar.js";
import { resetJwksCache } from "../api/_radar/security.js";

export const CLIENT_ID = "test-client.apps.googleusercontent.com";
export const ADMIN_SUB = "109876543210987654321";
export const BASE = "https://ivanimports.es";

export function makeGoogle() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const token = (claims = {}, { key = privateKey, kid = "k1", alg = "RS256", signIt = true } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg, kid, typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: CLIENT_ID, sub: ADMIN_SUB, email: "ivan@example.com", email_verified: true, iat: now, exp: now + 600, ...claims })).toString("base64url");
    const sig = signIt ? sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url") : "";
    return `${head}.${body}.${sig}`;
  };
  return { jwk, token, otherKey: other.privateKey };
}

export function fakeRedis(seed = {}) {
  const kv = new Map(Object.entries(seed.kv || {}));
  const sets = new Map(Object.entries(seed.sets || {}).map(([k, v]) => [k, new Set(v)]));
  const lists = new Map();
  const run = ([cmd, ...a]) => {
    switch (cmd.toUpperCase()) {
      case "GET": return kv.get(a[0]) ?? null;
      case "SET": { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], a[1]); return "OK"; }
      case "DEL": return kv.delete(a[0]) ? 1 : 0;
      case "INCR": { const n = Number(kv.get(a[0]) || 0) + 1; kv.set(a[0], String(n)); return n; }
      case "EXPIRE": return 1;
      case "SCARD": return sets.get(a[0])?.size || 0;
      case "SMEMBERS": return [...(sets.get(a[0]) || [])];
      case "LPUSH": { const l = lists.get(a[0]) || []; l.unshift(a[1]); lists.set(a[0], l); return l.length; }
      case "LTRIM": return "OK";
      case "SADD": { const set = sets.get(a[0]) || new Set(); set.add(a[1]); sets.set(a[0], set); return 1; }
      case "SREM": { sets.get(a[0])?.delete(a[1]); return 1; }
      case "EVAL": { const key = a[2]; const cur = kv.get(key); if (!cur) return -1; if (Number(JSON.parse(cur).version) !== Number(a[3])) return 0; kv.set(key, a[4]); return 1; }
      default: throw new Error(`comando no soportado ${cmd}`);
    }
  };
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("googleapis.com/oauth2")) return fetchImpl.google();
    const body = JSON.parse(init.body);
    if (u.endsWith("/pipeline")) return Response.json(body.map((c) => ({ result: run(c) })));
    return Response.json({ result: run(body) });
  };
  return { kv, sets, lists, fetchImpl };
}

export function setup({ env = {}, redisSeed, google = makeGoogle() } = {}) {
  resetJwksCache();
  const redis = fakeRedis(redisSeed);
  redis.fetchImpl.google = () => new Response(JSON.stringify({ keys: [google.jwk] }), { headers: { "cache-control": "max-age=3600" } });
  const fullEnv = { RADAR_GOOGLE_CLIENT_ID: CLIENT_ID, RADAR_ADMIN_GOOGLE_SUBS: ADMIN_SUB, RADAR_SESSION_SECRET: "x".repeat(40), UPSTASH_REDIS_REST_URL: "https://redis.test", UPSTASH_REDIS_REST_TOKEN: "t", VERCEL_ENV: "production", ...env };
  const uploads = [];
  const blobStore = { configured: true, put: async (path, body, type) => { uploads.push({ path, type, size: body.length }); return { url: `https://abc123.public.blob.vercel-storage.com/${path}` }; } };
  const handler = createRadarHandler({ env: fullEnv, fetchImpl: redis.fetchImpl, blobStore });
  const call = (action, { method = "GET", headers = {}, body, origin = BASE, cookie } = {}) => handler(new Request(`${BASE}/api/radar?action=${action}`, { method, headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }));
  const cookieOf = (response, name) => (response.headers.getSetCookie?.() || []).find((c) => c.startsWith(`${name}=`));
  async function login(claims, tokenOpts) {
    const n = await call("admin-nonce");
    const { nonce } = await n.json();
    const nonceCookie = cookieOf(n, "__Host-radar_nonce").split(";")[0];
    const credential = google.token({ nonce, ...claims }, tokenOpts);
    const r = await call("admin-login", { method: "POST", body: { credential }, cookie: nonceCookie });
    return { r, nonceCookie, credential };
  }
  async function admin() {
    const { r } = await login();
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith("__Host-radar_admin=")).split(";")[0];
    const { csrf } = await r.json();
    const post = (action, body, extra = {}) => call(action, { method: "POST", cookie, headers: { "x-radar-csrf": csrf, ...(extra.headers || {}) }, body });
    const get = (action, query = "") => handler(new Request(`${BASE}/api/radar?action=${action}${query}`, { headers: { cookie } }));
    return { cookie, csrf, post, get };
  }
  return { call, login, cookieOf, redis, google, env: fullEnv, admin, uploads, handler };
}
