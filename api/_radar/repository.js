import { hmac, randomToken } from "./security.js";

export const NS = "radar:v1:";

export function createRadarRepository(config, fetchImpl = fetch) {
  async function post(path, body) {
    const response = await fetchImpl(`${config.redisUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.redisToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw Object.assign(new Error("redis_unavailable"), { status: 503 });
    return response.json();
  }
  async function cmd(...args) {
    const out = await post("", args);
    if (out.error) throw Object.assign(new Error("redis_error"), { status: 503 });
    return out.result;
  }
  async function pipeline(commands) {
    const out = await post("/pipeline", commands);
    if (!Array.isArray(out) || out.some((item) => item.error)) throw Object.assign(new Error("redis_error"), { status: 503 });
    return out.map((item) => item.result);
  }
  const sessionKey = (id) => `${NS}session:${hmac(config.sessionSecret, id)}`;
  return {
    async createSession({ sub, csrf = randomToken(24) }) {
      const id = randomToken(32);
      const record = { sub, csrf, createdAt: new Date().toISOString() };
      await cmd("SET", sessionKey(id), JSON.stringify(record), "EX", String(config.sessionTtl));
      return { id, csrf };
    },
    async readSession(id) {
      if (!id || id.length < 32 || id.length > 128) return null;
      const raw = await cmd("GET", sessionKey(id));
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    async deleteSession(id) { if (id) await cmd("DEL", sessionKey(id)); },
    /** Un nonce de Google solo puede canjearse una vez. */
    async consumeNonce(nonce) {
      return (await cmd("SET", `${NS}nonce-used:${hmac(config.sessionSecret, nonce)}`, "1", "NX", "EX", "900")) === "OK";
    },
    async hit(key, windowSeconds) {
      const full = `${NS}rl:${key}`;
      const [count] = await pipeline([["INCR", full], ["EXPIRE", full, String(windowSeconds), "NX"]]);
      return Number(count);
    },
    async getVehicle(id) { const [raw] = await pipeline([["GET", `${NS}vehicle:${id}`]]); try { return raw ? JSON.parse(raw) : null; } catch { return null; } },
    async vehicleBySlug(slug) { const id = await cmd("GET", `${NS}slug:${slug}`); return id ? this.getVehicle(id) : null; },
    async listVehicles() { return this.getVehicles((await cmd("SMEMBERS", `${NS}idx:all`)) || []); },
    /** Creación idempotente: si el id ya existe devuelve el registro existente. */
    async createVehicle(record) {
      const ok = await cmd("SET", `${NS}vehicle:${record.id}`, JSON.stringify(record), "NX");
      if (ok !== "OK") return { created: false, record: await this.getVehicle(record.id) };
      await pipeline([["SADD", `${NS}idx:all`, record.id], ["SET", `${NS}slug:${record.slug}`, record.id], ...(record.published ? [["SADD", `${NS}idx:published`, record.id]] : [])]);
      return { created: true, record };
    },
    /** Compare-and-set por versión: dos pestañas o solicitudes repetidas no se pisan. */
    async saveVehicle(record, expectedVersion, previous) {
      const result = await cmd("EVAL", "local cur=redis.call('GET',KEYS[1]) if not cur then return -1 end local v=cjson.decode(cur).version if tonumber(v)~=tonumber(ARGV[1]) then return 0 end redis.call('SET',KEYS[1],ARGV[2]) return 1", "1", `${NS}vehicle:${record.id}`, String(expectedVersion), JSON.stringify(record));
      if (Number(result) !== 1) return false;
      await pipeline([[record.published ? "SADD" : "SREM", `${NS}idx:published`, record.id], ["LPUSH", `${NS}vehicle-history:${record.id}`, JSON.stringify(previous)], ["LTRIM", `${NS}vehicle-history:${record.id}`, "0", "19"]]);
      return true;
    },
    async deleteVehicle(record) { await pipeline([["DEL", `${NS}vehicle:${record.id}`], ["DEL", `${NS}slug:${record.slug}`], ["SREM", `${NS}idx:all`, record.id], ["SREM", `${NS}idx:published`, record.id]]); },
    async listTemplates() { const ids = (await cmd("SMEMBERS", `${NS}idx:templates`)) || []; if (!ids.length) return []; return (await pipeline(ids.map((id) => ["GET", `${NS}template:${id}`]))).map((r) => { try { return r ? JSON.parse(r) : null; } catch { return null; } }).filter(Boolean); },
    async saveTemplate(template) { await pipeline([["SET", `${NS}template:${template.id}`, JSON.stringify(template)], ["SADD", `${NS}idx:templates`, template.id]]); },
    async deleteTemplate(id) { await pipeline([["DEL", `${NS}template:${id}`], ["SREM", `${NS}idx:templates`, id]]); },
    async getVehicles(ids) {
      if (!ids.length) return [];
      const raw = await pipeline(ids.map((id) => ["GET", `${NS}vehicle:${id}`]));
      return raw.map((item) => { try { return item ? JSON.parse(item) : null; } catch { return null; } }).filter(Boolean);
    },
    async publishedIds() { return (await cmd("SMEMBERS", `${NS}idx:published`)) || []; },
    async audit(event) {
      await cmd("LPUSH", `${NS}audit`, JSON.stringify({ at: new Date().toISOString(), ...event }));
      await cmd("LTRIM", `${NS}audit`, "0", "499");
    },
  };
}
