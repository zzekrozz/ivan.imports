import test from "node:test";
import assert from "node:assert/strict";
import { createControlHandler } from "../api/control.js";

const SUBJECT = "a".repeat(64);
const env = {
  VERCEL_ENV: "test",
  ACADEMY_REDIS_REST_URL: "https://redis.example.test",
  ACADEMY_REDIS_REST_TOKEN: "redis-token",
  ACADEMY_DATA_SECRET: "d".repeat(32),
  ACADEMY_SESSION_SECRET: "s".repeat(32),
  ACADEMY_AUTH_SECRET: "a".repeat(32),
};

function redisFetch(_url, options) {
  const command = JSON.parse(options.body);
  const [verb, key] = command;
  let result = null;
  if (verb === "GET" && key.includes(":session:")) result = JSON.stringify({ subject: SUBJECT, emailMasked: "i***@example.com", expiresAt: 2000000000, createdAt: 1 });
  if (verb === "GET" && key.includes(":entitlement:")) result = JSON.stringify({ status: "active", programId: "importa-tu-primer-coche", subject: SUBJECT });
  return Promise.resolve(Response.json({ result }));
}

test("control data is denied without the existing authenticated session", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch, now: () => Date.parse("2026-08-18T10:00:00Z") });
  const response = await handler(new Request("https://ivanimports.es/api/control?action=state"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "unauthorized");
});

test("dashboard query returns an isolated empty aggregate for an authenticated user", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch, now: () => Date.parse("2026-08-18T10:00:00Z") });
  const response = await handler(new Request("https://ivanimports.es/api/control?action=state", { headers: { cookie: "ivan_academia=session-token" } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.revision, 0);
  assert.equal(body.state.user_id, SUBJECT);
  assert.deepEqual(body.state.projects, []);
});

test("control shell is noindex and does not expose user data", async () => {
  const handler = createControlHandler({ env, fetchImpl: redisFetch });
  const response = await handler(new Request("https://ivanimports.es/api/control?action=page&route=/control/quests/"));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.match(html, /Mission Control/);
  assert.doesNotMatch(html, new RegExp(SUBJECT));
});
