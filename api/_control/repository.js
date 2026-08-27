import { applyControlMutation, createDemoControlState, createEmptyControlState, normalizeControlState } from "../../assets/control/domain.js";

const STATE_TTL_SECONDS = 5 * 365 * 24 * 60 * 60;

function parseJson(value) {
  if (!value) return null;
  try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return null; }
}

export class ControlRepository {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async command(command) {
    if (!this.config.redisUrl || !this.config.redisToken) throw new Error("Mission Control Redis is not configured");
    const response = await this.fetchImpl(this.config.redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.redisToken}`,
        "Content-Type": "application/json",
        "User-Agent": "IvanImports-Mission-Control/1.0",
      },
      body: JSON.stringify(command),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.error) throw new Error(body.error || `Mission Control Redis command failed (${response.status})`);
    return body.result;
  }

  stateKey(subject) {
    return `mission-control:v1:user:${subject}`;
  }

  async getRecord(subject, { demo = false, now = Date.now() } = {}) {
    const record = parseJson(await this.command(["GET", this.stateKey(subject)]));
    if (record && Number.isInteger(record.revision)) {
      return { ...record, state: normalizeControlState(record.state, subject, { now }) };
    }
    return {
      state: demo ? createDemoControlState(subject, { now }) : createEmptyControlState(subject, { now }),
      revision: 0,
      updatedAt: null,
    };
  }

  async putRecord(subject, state, expectedRevision, now = Date.now()) {
    const script = `
      local current = redis.call('get', KEYS[1])
      local revision = 0
      if current then
        local ok, decoded = pcall(cjson.decode, current)
        if ok and decoded.revision then revision = tonumber(decoded.revision) or 0 end
      end
      if tonumber(ARGV[1]) ~= revision then return {0, revision} end
      local nextRevision = revision + 1
      local record = cjson.encode({ state = cjson.decode(ARGV[2]), revision = nextRevision, updatedAt = ARGV[4] })
      redis.call('set', KEYS[1], record, 'EX', ARGV[3])
      return {1, nextRevision, record}
    `;
    const updatedAt = new Date(now).toISOString();
    const result = await this.command(["EVAL", script, "1", this.stateKey(subject), String(expectedRevision), JSON.stringify(state), String(STATE_TTL_SECONDS), updatedAt]);
    if (!Array.isArray(result) || Number(result[0]) !== 1) return { conflict: true, revision: Number(result?.[1] || 0) };
    return parseJson(result[2]) || { state, revision: Number(result[1]), updatedAt };
  }

  async mutate(subject, mutation, { demo = false, now = Date.now(), attempts = 4 } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const record = await this.getRecord(subject, { demo, now });
      if (mutation.expected_revision !== undefined && Number(mutation.expected_revision) !== record.revision) {
        return { conflict: true, revision: record.revision, state: record.state };
      }
      const applied = applyControlMutation(record.state, mutation, { userId: subject, now });
      if (applied.idempotent) return { ...record, result: applied.result, idempotent: true };
      const saved = await this.putRecord(subject, applied.state, record.revision, now);
      if (!saved.conflict) return { ...saved, result: applied.result, idempotent: false };
    }
    return { conflict: true };
  }

  async resetDemo(subject, now = Date.now()) {
    const record = await this.getRecord(subject, { demo: true, now });
    return this.putRecord(subject, createDemoControlState(subject, { now }), record.revision, now);
  }
}

export function createControlRepository(config, fetchImpl = fetch) {
  return new ControlRepository(config, fetchImpl);
}
