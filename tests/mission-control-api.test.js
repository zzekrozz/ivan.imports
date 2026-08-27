import test from "node:test";
import assert from "node:assert/strict";
import { createControlHandler } from "../api/control.js";

const NOW = Date.parse("2026-08-18T10:00:00Z");
const env = {
  VERCEL_ENV: "test",
  ACADEMY_REDIS_REST_URL: "https://redis.example.test",
  ACADEMY_REDIS_REST_TOKEN: "redis-token",
  ACADEMY_DATA_SECRET: "d".repeat(32),
  ACADEMY_SESSION_SECRET: "s".repeat(32),
  ACADEMY_AUTH_SECRET: "a".repeat(32),
  MISSION_CONTROL_ACCESS_CODE: "mission-control-test-code",
};

function redisFetch(_url, options) {
  const command = JSON.parse(options.body);
  const [verb, key] = command;
  let result = null;
  return Promise.resolve(Response.json({ result }));
}

async function login(handler, code = "mission-control-test-code") {
  return handler(new Request("https://ivanimports.es/api/control?action=login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }));
}

test("control data is denied without the private control session", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch, now: () => NOW });
  const response = await handler(new Request("https://ivanimports.es/api/control?action=state"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});

test("the fixed access code creates a private HttpOnly session", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch, now: () => NOW });
  const rejected = await login(handler, "incorrecto");
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error, "invalid_access_code");

  const accepted = await login(handler);
  assert.equal(accepted.status, 200);
  assert.match(accepted.headers.get("set-cookie"), /^ivan_control=/);
  assert.match(accepted.headers.get("set-cookie"), /HttpOnly/);
  assert.match(accepted.headers.get("set-cookie"), /SameSite=Strict/);
});

test("dashboard query returns the owner's isolated aggregate after code login", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch, now: () => NOW });
  const loginResponse = await login(handler);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const response = await handler(new Request("https://ivanimports.es/api/control?action=state", { headers: { cookie } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revision, 0);
  assert.match(body.state.user_id, /^[a-f0-9]{64}$/);
  assert.deepEqual(body.state.projects, []);
});

test("control shell is noindex and does not expose user data", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch });
  const response = await handler(new Request("https://ivanimports.es/api/control?action=page&route=/control/quests/"));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.match(html, /Mission Control/);
  assert.doesNotMatch(html, /control1\.2/);
});
