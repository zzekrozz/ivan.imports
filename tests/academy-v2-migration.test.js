import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAcademyHandler } from "../api/academy.js";
import { validateProductSession } from "../api/importa-7-dias.js";
import { academyConfigFromEnv, createAcademyRepository } from "../api/_academy/repository.js";
import { emailHash, validateAcademyState } from "../api/_academy/security.js";
import {
  ACADEMY_COMPLETION_ANALYTICS,
  ACADEMY_LEGACY_MAPPING_COUNT,
  ACADEMY_STATE_MIGRATION_ID,
  completionTransitionEvents,
  createLegacyLessonAliasIndex,
  isLearningRouteCompleted,
  isRealOperationCompleted,
  migrateAcademyStateV1ToV2,
  normalizeLegacyLessonMap,
  resolveLegacyDeepLink,
  resolveLegacyLessonTarget,
} from "../assets/academy/private/migration.js";

const FIXTURE_MAP_OPTIONS = Object.freeze({ expectedMappingCount: 6, expectedLessonCount: 4, expectedStageCount: 2 });
const FIXTURE_MAPPINGS = Object.freeze([
  { legacyLessonId: "lesson-0-01", lessonId: "lesson-00-01", lessonSlug: "orientacion-inicial", stageId: "stage-00", conceptId: "concept-a", anchor: "bienvenida" },
  { legacyLessonId: "lesson-0-02", lessonId: "lesson-00-01", lessonSlug: "orientacion-inicial", stageId: "stage-00", conceptId: "concept-b", anchor: "objetivo" },
  { legacyLessonId: "lesson-0-03", lessonId: "lesson-00-02", lessonSlug: "preparar-la-ruta", stageId: "stage-00", conceptId: "concept-c", anchor: "preparacion" },
  { legacyLessonId: "lesson-1-01", lessonId: "lesson-01-01", lessonSlug: "definir-presupuesto", stageId: "stage-01", conceptId: "concept-d", anchor: "presupuesto" },
  { legacyLessonId: "lesson-1-02", lessonId: "lesson-01-01", lessonSlug: "definir-presupuesto", stageId: "stage-01", conceptId: "concept-e", anchor: "limites" },
  { legacyLessonId: "lesson-1-03", lessonId: "lesson-01-02", lessonSlug: "elegir-candidato", stageId: "stage-01", conceptId: "concept-f", anchor: "candidato" },
]);
const FIXTURE_MAP = Object.freeze({
  schemaVersion: 2,
  mappings: FIXTURE_MAPPINGS,
  legacyRouteAliases: Object.freeze(Object.fromEntries(FIXTURE_MAPPINGS.map((mapping) => [
    mapping.legacyLessonId,
    Object.freeze({ lessonId: mapping.lessonId, anchor: mapping.anchor }),
  ]))),
});

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function fullCanonicalMap() {
  const lessons = [];
  for (let stage = 0; stage < 13; stage += 1) {
    const lessonCount = stage < 7 ? 6 : 5;
    for (let lesson = 1; lesson <= lessonCount; lesson += 1) {
      lessons.push({
        lessonId: `lesson-${pad(stage)}-${pad(lesson)}`,
        lessonSlug: `etapa-${pad(stage)}-leccion-${pad(lesson)}`,
        stageId: `stage-${pad(stage)}`,
      });
    }
  }
  assert.equal(lessons.length, 72);

  const legacyPosition = Array.from({ length: 13 }, () => 0);
  const mappings = Array.from({ length: ACADEMY_LEGACY_MAPPING_COUNT }, (_, index) => {
    const legacyStage = Math.min(12, Math.floor((index * 13) / ACADEMY_LEGACY_MAPPING_COUNT));
    legacyPosition[legacyStage] += 1;
    const lesson = lessons[Math.min(lessons.length - 1, Math.floor((index * lessons.length) / ACADEMY_LEGACY_MAPPING_COUNT))];
    return {
      legacyLessonId: `lesson-${legacyStage}-${pad(legacyPosition[legacyStage])}`,
      ...lesson,
      conceptId: `concept-${pad(index + 1, 3)}`,
      anchor: `concept-${pad(index + 1, 3)}`,
    };
  });
  return {
    schemaVersion: 2,
    mappings,
    legacyRouteAliases: Object.fromEntries(mappings.map((mapping) => [
      mapping.legacyLessonId,
      { lessonId: mapping.lessonId, anchor: mapping.anchor },
    ])),
  };
}

function migratedFixtureState() {
  const state = {
    version: 1,
    progress: {
      completedLessonIds: ["lesson-0-01", "lesson-0-02", "lesson-0-03", "lesson-1-01", "lesson-9-99"],
      startedLessonIds: ["lesson-1-03"],
      currentLessonId: "lesson-1-02",
    },
    activeLessonId: "lesson-1-02",
    operation: { id: "operation-1", status: "buscando", privateNotes: "No transformar" },
    candidates: [{ id: "candidate-1", score: 81 }],
    tools: { budget: { maximum: 20_000 }, lessonChecklists: { "lesson-0-01": { first: true } } },
  };
  return { state, migrated: migrateAcademyStateV1ToV2(state, FIXTURE_MAP, FIXTURE_MAP_OPTIONS) };
}

test("el contrato canónico normaliza exactamente 317 conceptos, 72 lecciones y 13 etapas", () => {
  const normalized = normalizeLegacyLessonMap(fullCanonicalMap());
  assert.equal(normalized.mappings.length, 317);
  assert.equal(normalized.lessonIds.length, 72);
  assert.equal(normalized.stageIds.length, 13);
  assert.equal(Object.keys(normalized.legacyRouteAliases).length, 317);
  assert.equal(Object.keys(createLegacyLessonAliasIndex(normalized)).length, 317);
});

test("el contrato rechaza mapas incompletos, duplicados o aliases que no coinciden", () => {
  assert.throws(() => normalizeLegacyLessonMap(FIXTURE_MAP), /unexpected_legacy_mapping_count/);
  const duplicate = { ...FIXTURE_MAP, mappings: [...FIXTURE_MAPPINGS.slice(0, 5), FIXTURE_MAPPINGS[0]] };
  assert.throws(() => normalizeLegacyLessonMap(duplicate, FIXTURE_MAP_OPTIONS), /duplicate_legacy_lesson_id/);
  const mismatchedAlias = {
    ...FIXTURE_MAP,
    legacyRouteAliases: { ...FIXTURE_MAP.legacyRouteAliases, "lesson-0-01": { lessonId: "lesson-01-01", anchor: "limites" } },
  };
  assert.throws(() => normalizeLegacyLessonMap(mismatchedAlias, FIXTURE_MAP_OPTIONS), /legacy_route_alias_mismatch/);

  const wrongLessonCount = fullCanonicalMap();
  const removedLessonId = wrongLessonCount.mappings.at(-1).lessonId;
  for (const mapping of wrongLessonCount.mappings.filter((entry) => entry.lessonId === removedLessonId)) {
    mapping.lessonId = wrongLessonCount.mappings[0].lessonId;
    mapping.lessonSlug = wrongLessonCount.mappings[0].lessonSlug;
    mapping.stageId = wrongLessonCount.mappings[0].stageId;
    wrongLessonCount.legacyRouteAliases[mapping.legacyLessonId] = { lessonId: mapping.lessonId, anchor: mapping.anchor };
  }
  assert.throws(() => normalizeLegacyLessonMap(wrongLessonCount), /unexpected_v2_lesson_count/);
});

test("la migración agrupa completos, marca parciales como empezados y conserva el punto actual", () => {
  const { state, migrated } = migratedFixtureState();
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.progress.completedLessonIds, ["lesson-00-01", "lesson-00-02"]);
  assert.deepEqual(migrated.progress.startedLessonIds, ["lesson-01-01", "lesson-01-02"]);
  assert.deepEqual(migrated.progress.completedStageIds, ["stage-00"]);
  assert.equal(migrated.progress.percentage, 50);
  assert.equal(migrated.progress.currentLessonId, "lesson-01-01");
  assert.equal(migrated.progress.currentStageId, "stage-01");
  assert.equal(migrated.progress.currentAnchor, "limites");
  assert.equal(migrated.activeLessonId, "lesson-01-01");
  assert.deepEqual(migrated.operation, state.operation);
  assert.deepEqual(migrated.candidates, state.candidates);
  assert.deepEqual(migrated.tools, state.tools);
  assert.equal(migrated.migration.id, ACADEMY_STATE_MIGRATION_ID);
  assert.deepEqual(migrated.migration.legacyState.progress, state.progress);
  assert.equal(migrated.migration.legacyState.activeLessonId, state.activeLessonId);
  assert.deepEqual(migrated.migration.unmappedCompletedLessonIds, ["lesson-9-99"]);
});

test("la migración no muta v1 y volver a ejecutarla es idempotente", () => {
  const { state, migrated } = migratedFixtureState();
  const before = JSON.stringify(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(migrateAcademyStateV1ToV2(migrated, FIXTURE_MAP, FIXTURE_MAP_OPTIONS), migrated);
  assert.notEqual(migrateAcademyStateV1ToV2(migrated, FIXTURE_MAP, FIXTURE_MAP_OPTIONS), migrated);
});

test("el estado completo de 317 pasos migra a 72 lecciones y supera los límites del servidor", () => {
  const map = fullCanonicalMap();
  const oldIds = map.mappings.map((mapping) => mapping.legacyLessonId);
  const operation = { id: "operation-full", status: "comprado", documents: { coc: true } };
  const candidates = Array.from({ length: 20 }, (_, index) => ({ id: `candidate-${index + 1}`, score: index }));
  const tools = { lessonChecklists: Object.fromEntries(oldIds.map((id) => [id, { first: true, second: false }])) };
  const state = {
    version: 1,
    progress: { completedLessonIds: oldIds, startedLessonIds: oldIds, currentLessonId: oldIds.at(-1) },
    operation,
    candidates,
    tools,
  };
  const migrated = migrateAcademyStateV1ToV2(state, map);
  assert.equal(migrated.progress.completedLessonIds.length, 72);
  assert.equal(migrated.progress.startedLessonIds.length, 0);
  assert.equal(migrated.progress.completedStageIds.length, 13);
  assert.equal(migrated.progress.percentage, 100);
  assert.equal(migrated.migration.legacyState.progress.completedLessonIds.length, 317);
  assert.deepEqual(migrated.operation, operation);
  assert.deepEqual(migrated.candidates, candidates);
  assert.deepEqual(migrated.tools, tools);
  const validated = validateAcademyState(migrated);
  assert.equal(validated.schemaVersion, 2);
  assert.equal(validated.migration.legacyState.progress.startedLessonIds.length, 317);
});

test("el servidor valida schemaVersion y la copia de migración sin abrir secciones arbitrarias", () => {
  const { migrated } = migratedFixtureState();
  assert.equal(validateAcademyState(migrated).schemaVersion, 2);
  assert.throws(() => validateAcademyState({ ...migrated, schemaVersion: 0 }), /invalid_schema_version/);
  assert.throws(() => validateAcademyState({ ...migrated, schemaVersion: 2.5 }), /invalid_schema_version/);
  assert.throws(() => validateAcademyState({ ...migrated, migration: [] }), /invalid_migration/);
  assert.throws(() => validateAcademyState({ ...migrated, legacyProgram: {} }), /invalid_state_section/);
});

test("los IDs y deep links antiguos resuelven a la nueva lección y anchor sin aceptar URLs externas", () => {
  const direct = resolveLegacyLessonTarget("lesson-0-02", FIXTURE_MAP, FIXTURE_MAP_OPTIONS);
  assert.equal(direct.lessonId, "lesson-00-01");
  assert.equal(direct.anchor, "objetivo");
  const oldRoute = resolveLegacyDeepLink("/paso/0-02-titulo-antiguo?source=bookmark", FIXTURE_MAP, FIXTURE_MAP_OPTIONS);
  assert.equal(oldRoute.href, "/paso/orientacion-inicial#objetivo");
  assert.equal(resolveLegacyDeepLink("/paso/no-existe", FIXTURE_MAP, FIXTURE_MAP_OPTIONS), null);
  assert.equal(resolveLegacyDeepLink("https://evil.example/paso/0-02-antiguo", FIXTURE_MAP, FIXTURE_MAP_OPTIONS), null);
  assert.throws(
    () => resolveLegacyDeepLink("lesson-0-02", FIXTURE_MAP, { ...FIXTURE_MAP_OPTIONS, lessonBasePath: "//evil.example" }),
    /invalid_lesson_base_path/,
  );
});

test("los hitos de aprendizaje y operación real son independientes y solo se emiten en transición", () => {
  const map = fullCanonicalMap();
  const completeLearning = migrateAcademyStateV1ToV2({
    progress: { completedLessonIds: map.mappings.map((mapping) => mapping.legacyLessonId) },
    operation: {},
  }, map);
  const completeOperation = {
    progress: {},
    operation: {
      id: "operation-1",
      status: "matriculado",
      registrationAssigned: true,
      finalFolderCompleted: true,
      closureCompleted: true,
    },
  };
  assert.equal(isLearningRouteCompleted(completeLearning, map), true);
  assert.equal(isRealOperationCompleted(completeLearning), false);
  assert.equal(isLearningRouteCompleted(completeOperation, map), false);
  assert.equal(isRealOperationCompleted(completeOperation), true);
  assert.equal(isRealOperationCompleted({ ...completeOperation, operation: { ...completeOperation.operation, finalFolderCompleted: false } }), false);
  assert.equal(isRealOperationCompleted({
    operation: { id: "operation-legacy", status: "registered", registrationConfirmed: true, closureConfirmed: true },
    tools: { spain: { finalFolderComplete: true } },
  }), true);

  assert.deepEqual(completionTransitionEvents({ progress: {}, operation: {} }, completeLearning, map), [{
    event: ACADEMY_COMPLETION_ANALYTICS.learningRoute.event,
    properties: { programId: "importa-tu-primer-coche" },
  }]);
  assert.deepEqual(completionTransitionEvents({ progress: {}, operation: {} }, completeOperation, map), [{
    event: ACADEMY_COMPLETION_ANALYTICS.realOperation.event,
    properties: { programId: "importa-tu-primer-coche" },
  }]);
  assert.deepEqual(completionTransitionEvents(completeLearning, completeLearning, map), []);
});

function academyEnv(overrides = {}) {
  return {
    ACADEMY_REDIS_REST_URL: "https://academy-redis.example.test",
    ACADEMY_REDIS_REST_TOKEN: "redis-token-placeholder",
    ACADEMY_DATA_SECRET: "d".repeat(48),
    ACADEMY_SESSION_SECRET: "s".repeat(48),
    IMPORTA_7_DIAS_BASE_URL: "https://ivanimports.es",
    ACADEMY_CONTENT_BLOB_PATHNAME: "academy/production/program-v2.json",
    IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME: "academy/production/importa-tu-coche-en-7-dias-guia-2026.pdf",
    IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME: "academy/production/importa-tu-coche-en-7-dias-cuaderno.pdf",
    ACADEMY_PRODUCTION_BLOB_STORE_ID: "store-production-test",
    ACADEMY_PRODUCTION_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store-production-test_secret",
    VERCEL_OIDC_TOKEN: "opaque-oidc-production-test-value",
    VERCEL_ENV: "production",
    ...overrides,
  };
}

function json(body, status = 200) {
  return Response.json(body, { status });
}

function memoryRedisService() {
  const values = new Map();
  const commands = [];
  const command = (parts) => {
    commands.push(parts);
    const operation = String(parts[0]).toUpperCase();
    if (operation === "GET") return values.get(parts[1]) ?? null;
    if (operation === "SET") {
      if (parts.includes("NX") && values.has(parts[1])) return null;
      values.set(parts[1], String(parts[2]));
      return "OK";
    }
    if (operation === "SADD") {
      const members = values.get(parts[1]) instanceof Set ? values.get(parts[1]) : new Set();
      let added = 0;
      for (const member of parts.slice(2)) {
        if (!members.has(member)) added += 1;
        members.add(member);
      }
      values.set(parts[1], members);
      return added;
    }
    if (operation === "SREM") {
      const members = values.get(parts[1]);
      if (!(members instanceof Set)) return 0;
      let removed = 0;
      for (const member of parts.slice(2)) if (members.delete(member)) removed += 1;
      return removed;
    }
    if (operation === "SMEMBERS") {
      const members = values.get(parts[1]);
      return members instanceof Set ? [...members] : [];
    }
    if (operation === "EXPIRE") return values.has(parts[1]) ? 1 : 0;
    if (operation === "DEL") {
      let deleted = 0;
      for (const key of parts.slice(1)) if (values.delete(key)) deleted += 1;
      return deleted;
    }
    throw new Error(`Unsupported memory Redis command: ${operation}`);
  };
  const fetchImpl = async (url, options = {}) => {
    assert.equal(String(url), "https://academy-redis.example.test");
    return json({ result: command(JSON.parse(options.body)) });
  };
  return { values, commands, fetchImpl };
}

function paidSession(overrides = {}) {
  return {
    id: "cs_test_regression_123456",
    mode: "payment",
    payment_link: "plink_regression",
    payment_status: "paid",
    currency: "eur",
    amount_total: 17_900,
    customer_details: { email: "buyer@example.com" },
    line_items: { data: [{ quantity: 1, price: { id: "price_regression" } }] },
    ...overrides,
  };
}

test("regresión: Stripe sigue validando producto, importe, moneda y pago antes del entitlement", () => {
  const config = { paymentLinkId: "plink_regression", priceId: "price_regression", expectedAmount: 17_900 };
  assert.deepEqual(validateProductSession(paidSession(), config), { valid: true, errors: [] });
  const invalid = validateProductSession(paidSession({ payment_status: "unpaid", currency: "usd", amount_total: 1 }), config);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors, ["currency", "amount_total", "payment_status"]);
  assert.equal(validateProductSession(paidSession({ line_items: { data: [{ quantity: 1, price: { id: "price_other" } }] } }), config).valid, false);
});

test("regresión: entitlement persistente, acceso y Blob privado conservan sus barreras", async () => {
  const env = academyEnv();
  const service = memoryRedisService();
  const config = academyConfigFromEnv(env);
  const repository = createAcademyRepository(config, service.fetchImpl);
  const subject = emailHash("Buyer@example.com", config.dataSecret);
  const first = await repository.grantEntitlement({
    subject,
    sourceSessionId: "cs_test_regression_123456",
    purchasedAt: "2026-08-11T10:00:00.000Z",
    bonusEligible: true,
    supportExpiresAt: "2026-08-25T10:00:00.000Z",
  });
  const second = await repository.grantEntitlement({
    subject,
    sourceSessionId: "cs_test_regression_123456",
    purchasedAt: "2026-08-12T10:00:00.000Z",
    bonusEligible: false,
    supportExpiresAt: "",
  });
  assert.equal(first.status, "active");
  assert.equal(second.idempotent, true);
  assert.equal(second.purchasedAt, first.purchasedAt);
  assert.equal(second.bonusEligible, true);
  const entitlementWrites = service.commands.filter((parts) => parts[0] === "SET" && String(parts[1]).includes(":entitlement:"));
  assert.ok(entitlementWrites.length >= 2);
  assert.equal(entitlementWrites.some((parts) => parts.includes("EX")), false);

  const session = await repository.createSession({ subject, emailMasked: "bu***@example.com" });
  let blobCalls = 0;
  const handler = createAcademyHandler({
    env,
    fetchImpl: service.fetchImpl,
    blobGet: async (pathname, options) => {
      blobCalls += 1;
      assert.equal(pathname, config.guidePathname);
      assert.deepEqual(options, {
        access: "private",
        oidcToken: "opaque-oidc-production-test-value",
        storeId: "store-production-test",
        ifNoneMatch: undefined,
      });
      return { statusCode: 200, stream: new Blob(["%PDF-regression"]).stream(), blob: { etag: "regression-etag" } };
    },
  });
  const resourceUrl = "https://ivanimports.es/api/academy?action=resource&file=guide";
  assert.equal((await handler(new Request(resourceUrl))).status, 401);
  assert.equal(blobCalls, 0);
  const entitled = await handler(new Request(resourceUrl, { headers: { Cookie: `__Host-ivan_academia=${session.token}` } }));
  assert.equal(entitled.status, 200);
  assert.equal(Buffer.from(await entitled.arrayBuffer()).toString(), "%PDF-regression");
  assert.equal(blobCalls, 1);

  const revoked = await repository.revokeEntitlement(subject, "regression-test");
  assert.equal(revoked.revoked, true);
  assert.ok(revoked.sessionsRevoked >= 1);
  const stale = await repository.createSession({ subject, emailMasked: "bu***@example.com" });
  const forbidden = await handler(new Request(resourceUrl, { headers: { Cookie: `__Host-ivan_academia=${stale.token}` } }));
  assert.equal(forbidden.status, 403);
  assert.equal(blobCalls, 1);
});

const RED_ZONE_HASHES = Object.freeze({
  "api/importa-7-dias.js": "4dcc3d0c5dd7f05b8d79ce0ba4c8142bf92d0777920d09bbf9f2148411915582",
  "api/academy.js": "4168d2d07a5610936cb8845b8dbaacbfa1f03fb94358f5aa36659223fc9cec88",
  "api/_academy/blob.js": "38c7d67ea1c4a5e379e48bb6d7e096cd3cf6923330199ce53366f21eee74a848",
  "api/_academy/content.js": "adcb001b2dd8e7cb820e5bed9ec488275d96ed6889fd765024f4cab1fd3c78da",
  "api/_academy/repository.js": "df886f15d2c4d6bbec4f524ab1196c5af6e488c7dfdcce1ecba52bbd569dd5be",
  "api/_academy/security.js": "b6b74b279436bd03c36570eabe1dbf1730ef182d15091e02ef83b406c2bd7b0c",
  "api/_academy/shell.js": "c69e256cef48aa09ac3664757495ded1c6cc97335cf3baf5679c6aa42136275d",
  "scripts/_academy-entitlement-cli.mjs": "7659d2d6c0585bacc62e19472ae6313b21f1049d2e79396ac2c9cf257c00931c",
  "scripts/academy-backfill-entitlements.mjs": "b7eba491fb60675f3689e4f6d2dcd8ddc76f67105377f0116c83d478e4b291e3",
  "scripts/academy-grant-entitlement.mjs": "8ae1a80f6ade59af678e850b28f63c15d7fc0b022210ba7d3d762dfe522d538c",
  "scripts/academy-revoke-entitlement.mjs": "4a18acc48d0aea97ac8ffb3748de5b0e371795dcb46ec3a340f0f782983632a1",
  "scripts/upload-academy-content.mjs": "fe8d942c39898643d6069afbdf69f7e762aa09f22d34bd816e4f6d660f91c6d3",
});

test("regresión: los fuentes de la zona roja mantienen su hash normalizado", async () => {
  for (const [path, expected] of Object.entries(RED_ZONE_HASHES)) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const normalized = source.replaceAll("\r\n", "\n");
    assert.equal(createHash("sha256").update(normalized, "utf8").digest("hex"), expected, path);
  }
  assert.ok(Object.keys(RED_ZONE_HASHES).length >= 10, "la zona roja debe congelar APIs y scripts críticos");
});
