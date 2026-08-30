import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const REPORT_TTL_SECONDS = 60 * 60 * 24 * 365;
const RAW_TTL_SECONDS = 60 * 60 * 24 * 30;

export function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function verifyToken(token, expectedHash) {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createAccessToken() {
  return randomBytes(24).toString("base64url");
}

export function publicReport(report) {
  if (!report) return null;
  const { accessTokenHash, callbackTokenHash, ...safe } = report;
  return safe;
}

export class MemoryIVIRepository {
  constructor() { this.reports = new Map(); this.raw = new Map(); this.analytics = new Map(); }
  async putReport(report) { this.reports.set(report.id, structuredClone(report)); return report; }
  async getReport(id) { const report = this.reports.get(id); return report ? structuredClone(report) : null; }
  async putRaw(id, payload) { this.raw.set(id, structuredClone(payload)); }
  async getRaw(id) { const payload = this.raw.get(id); return payload ? structuredClone(payload) : null; }
  async increment(metric) { this.analytics.set(metric, (this.analytics.get(metric) || 0) + 1); }
}

class UpstashIVIRepository {
  constructor({ url, token, namespace = "ivi:preview", fetchImpl = fetch, reportTtl = REPORT_TTL_SECONDS, rawTtl = RAW_TTL_SECONDS }) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
    this.namespace = namespace;
    this.fetchImpl = fetchImpl;
    this.reportTtl = reportTtl;
    this.rawTtl = rawTtl;
  }
  key(...parts) { return [this.namespace, ...parts].join(":"); }
  async command(command) {
    const response = await this.fetchImpl(this.url, { method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" }, body: JSON.stringify(command) });
    if (!response.ok) throw new Error(`IVI repository responded ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`IVI repository error: ${body.error}`);
    return body.result;
  }
  async putReport(report) { await this.command(["SET", this.key("report", report.id), JSON.stringify(report), "EX", String(this.reportTtl)]); return report; }
  async getReport(id) { const value = await this.command(["GET", this.key("report", id)]); try { return value ? JSON.parse(value) : null; } catch { return null; } }
  async putRaw(id, payload) { await this.command(["SET", this.key("raw", id), JSON.stringify(payload), "EX", String(this.rawTtl)]); }
  async getRaw(id) { const value = await this.command(["GET", this.key("raw", id)]); try { return value ? JSON.parse(value) : null; } catch { return null; } }
  async increment(metric) { await this.command(["INCR", this.key("analytics", new Date().toISOString().slice(0, 10), metric)]); }
}

export function createIVIRepository(env = process.env, fetchImpl = fetch) {
  const url = env.IVI_REDIS_REST_URL || env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.IVI_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const environment = env.VERCEL_ENV === "production" ? "production" : "preview";
  return new UpstashIVIRepository({ url, token, namespace: `ivi:${environment}`, fetchImpl, reportTtl: Number(env.IVI_REPORT_TTL_SECONDS) || REPORT_TTL_SECONDS, rawTtl: Number(env.IVI_RAW_TTL_SECONDS) || RAW_TTL_SECONDS });
}
