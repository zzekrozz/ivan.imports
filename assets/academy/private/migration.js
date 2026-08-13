export const ACADEMY_STATE_SCHEMA_VERSION = 2;
export const ACADEMY_STATE_MIGRATION_ID = "academy-state-v1-to-v2";
export const ACADEMY_LEGACY_MAPPING_COUNT = 317;
export const ACADEMY_V2_LESSON_COUNT = 72;
export const ACADEMY_V2_STAGE_COUNT = 13;

export const ACADEMY_COMPLETION_ANALYTICS = Object.freeze({
  learningRoute: Object.freeze({
    event: "academy_learning_route_completed",
    meaning: "Las lecciones principales de la ruta de aprendizaje están completadas.",
  }),
  realOperation: Object.freeze({
    event: "academy_real_operation_completed",
    meaning: "Una operación real cumple las confirmaciones explícitas de matrícula y cierre.",
  }),
});

const NORMALIZED_MAP = Symbol("normalized-academy-legacy-map");
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const ROUTE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const DEFAULT_LESSON_BASE_PATH = "/paso";

function migrationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function requiredString(value, pattern, code) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || !pattern.test(normalized)) throw migrationError(code);
  return normalized;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === "string" && value.length <= 128))];
}

function normalizedMap(value, options) {
  return value?.[NORMALIZED_MAP] ? value : normalizeLegacyLessonMap(value, options);
}

function targetFromMapping(mapping) {
  return Object.freeze({
    legacyLessonId: mapping.legacyLessonId,
    lessonId: mapping.lessonId,
    lessonSlug: mapping.lessonSlug,
    stageId: mapping.stageId,
    conceptId: mapping.conceptId,
    anchor: mapping.anchor,
  });
}

export function normalizeLegacyLessonMap(value, {
  expectedMappingCount = ACADEMY_LEGACY_MAPPING_COUNT,
  expectedLessonCount = ACADEMY_V2_LESSON_COUNT,
  expectedStageCount = ACADEMY_V2_STAGE_COUNT,
} = {}) {
  if (!isPlainObject(value) || value.schemaVersion !== 2 || !Array.isArray(value.mappings)) {
    throw migrationError("invalid_legacy_lesson_map");
  }
  if (value.mappings.length < 1 || value.mappings.length > 2_000) {
    throw migrationError("invalid_legacy_mapping_count");
  }
  if (expectedMappingCount !== undefined && value.mappings.length !== expectedMappingCount) {
    throw migrationError("unexpected_legacy_mapping_count");
  }

  const legacyIds = new Set();
  const conceptIds = new Set();
  const lessonAnchors = new Set();
  const lessonMetadata = new Map();
  const mappings = value.mappings.map((entry) => {
    if (!isPlainObject(entry)) throw migrationError("invalid_legacy_mapping");
    const mapping = {
      legacyLessonId: requiredString(entry.legacyLessonId, ID_PATTERN, "invalid_legacy_lesson_id"),
      lessonId: requiredString(entry.lessonId, ID_PATTERN, "invalid_v2_lesson_id"),
      lessonSlug: requiredString(entry.lessonSlug, SLUG_PATTERN, "invalid_v2_lesson_slug"),
      stageId: requiredString(entry.stageId, ID_PATTERN, "invalid_v2_stage_id"),
      conceptId: requiredString(entry.conceptId, ID_PATTERN, "invalid_concept_id"),
      anchor: requiredString(entry.anchor, ROUTE_TOKEN_PATTERN, "invalid_concept_anchor"),
    };
    if (legacyIds.has(mapping.legacyLessonId)) throw migrationError("duplicate_legacy_lesson_id");
    if (conceptIds.has(mapping.conceptId)) throw migrationError("duplicate_legacy_concept_id");
    const lessonAnchor = `${mapping.lessonId}#${mapping.anchor}`;
    if (lessonAnchors.has(lessonAnchor)) throw migrationError("duplicate_lesson_anchor");

    const knownLesson = lessonMetadata.get(mapping.lessonId);
    if (knownLesson && (knownLesson.lessonSlug !== mapping.lessonSlug || knownLesson.stageId !== mapping.stageId)) {
      throw migrationError("inconsistent_v2_lesson_metadata");
    }
    legacyIds.add(mapping.legacyLessonId);
    conceptIds.add(mapping.conceptId);
    lessonAnchors.add(lessonAnchor);
    lessonMetadata.set(mapping.lessonId, { lessonSlug: mapping.lessonSlug, stageId: mapping.stageId });
    return Object.freeze(mapping);
  });

  const byLegacyLessonId = Object.create(null);
  const byLessonId = Object.create(null);
  const legacyRouteAliases = Object.create(null);
  for (const mapping of mappings) {
    const target = targetFromMapping(mapping);
    byLegacyLessonId[mapping.legacyLessonId] = target;
    legacyRouteAliases[mapping.legacyLessonId] = Object.freeze({ lessonId: mapping.lessonId, anchor: mapping.anchor });
    if (!byLessonId[mapping.lessonId]) byLessonId[mapping.lessonId] = [];
    byLessonId[mapping.lessonId].push(mapping);
  }

  if (value.legacyRouteAliases !== undefined && !isPlainObject(value.legacyRouteAliases)) {
    throw migrationError("invalid_legacy_route_aliases");
  }
  for (const [alias, aliasTarget] of Object.entries(value.legacyRouteAliases || {})) {
    const safeAlias = requiredString(alias, ID_PATTERN, "invalid_legacy_route_alias");
    if (!isPlainObject(aliasTarget)) throw migrationError("invalid_legacy_route_target");
    const lessonId = requiredString(aliasTarget.lessonId, ID_PATTERN, "invalid_legacy_route_lesson_id");
    const anchor = requiredString(aliasTarget.anchor, ROUTE_TOKEN_PATTERN, "invalid_legacy_route_anchor");
    const canonical = byLegacyLessonId[safeAlias]
      || byLessonId[lessonId]?.find((mapping) => mapping.anchor === anchor);
    if (!canonical || canonical.lessonId !== lessonId || canonical.anchor !== anchor) {
      throw migrationError("legacy_route_alias_mismatch");
    }
    legacyRouteAliases[safeAlias] = Object.freeze({ lessonId, anchor });
  }

  for (const lessonId of Object.keys(byLessonId)) Object.freeze(byLessonId[lessonId]);
  const lessonIds = [...lessonMetadata.keys()];
  const stageIds = [...new Set(mappings.map((mapping) => mapping.stageId))];
  if (expectedLessonCount !== null && lessonIds.length !== expectedLessonCount) {
    throw migrationError("unexpected_v2_lesson_count");
  }
  if (expectedStageCount !== null && stageIds.length !== expectedStageCount) {
    throw migrationError("unexpected_v2_stage_count");
  }
  const result = {
    schemaVersion: 2,
    mappings: Object.freeze(mappings),
    legacyRouteAliases: Object.freeze(legacyRouteAliases),
    byLegacyLessonId: Object.freeze(byLegacyLessonId),
    byLessonId: Object.freeze(byLessonId),
    legacyLessonIds: Object.freeze(mappings.map((mapping) => mapping.legacyLessonId)),
    lessonIds: Object.freeze(lessonIds),
    stageIds: Object.freeze(stageIds),
  };
  Object.defineProperty(result, NORMALIZED_MAP, { value: true });
  return Object.freeze(result);
}

export function createLegacyLessonAliasIndex(legacyMap, options) {
  const map = normalizedMap(legacyMap, options);
  const index = Object.create(null);
  for (const mapping of map.mappings) index[mapping.legacyLessonId] = targetFromMapping(mapping);
  for (const [alias, target] of Object.entries(map.legacyRouteAliases)) {
    const canonical = map.byLessonId[target.lessonId]?.find((mapping) => mapping.anchor === target.anchor);
    if (canonical) index[alias] = targetFromMapping({ ...canonical, legacyLessonId: alias });
  }
  return Object.freeze(index);
}

function deepLinkSegment(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw || raw.length > 2_048 || raw.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) return "";
  const path = raw.split("#", 1)[0].split("?", 1)[0].replace(/\/+$/, "");
  const segment = path.slice(path.lastIndexOf("/") + 1);
  try { return decodeURIComponent(segment); } catch { return ""; }
}

function legacyCandidates(segment) {
  const candidates = [segment];
  const legacyId = segment.match(/^(lesson-\d{1,2}-\d{2})(?:-|$)/i)?.[1];
  if (legacyId) candidates.push(legacyId);
  const oldSlug = segment.match(/^(\d{1,2})-(\d{2})(?:-|$)/);
  if (oldSlug) candidates.push(`lesson-${Number(oldSlug[1])}-${oldSlug[2]}`);
  return [...new Set(candidates)];
}

export function resolveLegacyLessonTarget(value, legacyMap, options) {
  const map = normalizedMap(legacyMap, options);
  const aliases = createLegacyLessonAliasIndex(map);
  const segment = deepLinkSegment(value);
  for (const candidate of legacyCandidates(segment)) {
    if (aliases[candidate]) return cloneJson(aliases[candidate]);
  }
  return null;
}

export function resolveLegacyDeepLink(value, legacyMap, { lessonBasePath = DEFAULT_LESSON_BASE_PATH, ...mapOptions } = {}) {
  if (!/^\/[a-z0-9/_-]*$/i.test(lessonBasePath) || lessonBasePath.includes("//")) {
    throw migrationError("invalid_lesson_base_path");
  }
  const target = resolveLegacyLessonTarget(value, legacyMap, mapOptions);
  if (!target) return null;
  const base = lessonBasePath.replace(/\/+$/, "") || DEFAULT_LESSON_BASE_PATH;
  return {
    ...target,
    href: `${base}/${encodeURIComponent(target.lessonSlug)}#${encodeURIComponent(target.anchor)}`,
  };
}

function migrationLegacySnapshot(state) {
  const snapshot = {
    schemaVersion: Number.isInteger(state.schemaVersion) ? state.schemaVersion : 1,
    progress: cloneJson(isPlainObject(state.progress) ? state.progress : {}),
  };
  if (Object.hasOwn(state, "version")) snapshot.version = cloneJson(state.version);
  if (Object.hasOwn(state, "activeLessonId")) snapshot.activeLessonId = cloneJson(state.activeLessonId);
  return snapshot;
}

export function migrateAcademyStateV1ToV2(state, legacyMap, options = {}) {
  if (!isPlainObject(state)) throw migrationError("invalid_academy_state");
  if (Number.isInteger(state.schemaVersion) && state.schemaVersion >= ACADEMY_STATE_SCHEMA_VERSION) return cloneJson(state);

  const map = normalizedMap(legacyMap, options);
  const original = cloneJson(state);
  const originalProgress = isPlainObject(original.progress) ? original.progress : {};
  const completedInput = uniqueStrings(originalProgress.completedLessonIds);
  const startedInput = uniqueStrings(originalProgress.startedLessonIds);
  const completedSource = new Set(completedInput);
  const completed = new Set();
  const started = new Set();
  const newLessonIds = new Set(map.lessonIds);

  for (const lessonId of completedInput) if (newLessonIds.has(lessonId)) completed.add(lessonId);
  for (const lessonId of startedInput) {
    if (newLessonIds.has(lessonId)) started.add(lessonId);
    const target = resolveLegacyLessonTarget(lessonId, map);
    if (target) started.add(target.lessonId);
  }

  for (const lessonId of map.lessonIds) {
    const associated = map.byLessonId[lessonId];
    const completedCount = associated.filter((mapping) => completedSource.has(mapping.legacyLessonId)).length;
    if (completedCount === associated.length || completed.has(lessonId)) completed.add(lessonId);
    else if (completedCount > 0) started.add(lessonId);
  }

  const originalCurrent = typeof originalProgress.currentLessonId === "string" && originalProgress.currentLessonId
    ? originalProgress.currentLessonId
    : typeof original.activeLessonId === "string" ? original.activeLessonId : "";
  const currentTarget = resolveLegacyLessonTarget(originalCurrent, map);
  const currentIsV2 = newLessonIds.has(originalCurrent);
  const currentLessonId = currentTarget?.lessonId || (currentIsV2 ? originalCurrent : originalCurrent);
  const currentLessonMappings = currentLessonId ? map.byLessonId[currentLessonId] : null;
  if (currentLessonId && newLessonIds.has(currentLessonId) && !completed.has(currentLessonId)) started.add(currentLessonId);
  for (const lessonId of completed) started.delete(lessonId);

  const completedLessonIds = map.lessonIds.filter((lessonId) => completed.has(lessonId));
  const startedLessonIds = map.lessonIds.filter((lessonId) => started.has(lessonId));
  const completedStageIds = map.stageIds.filter((stageId) => {
    const lessons = map.lessonIds.filter((lessonId) => map.byLessonId[lessonId][0].stageId === stageId);
    return lessons.length > 0 && lessons.every((lessonId) => completed.has(lessonId));
  });
  const percentage = map.lessonIds.length ? Math.round((completedLessonIds.length / map.lessonIds.length) * 100) : 0;
  const unmappedCompletedLessonIds = completedInput.filter((lessonId) => !newLessonIds.has(lessonId) && !map.byLegacyLessonId[lessonId]);
  const unmappedStartedLessonIds = startedInput.filter((lessonId) => !newLessonIds.has(lessonId) && !map.byLegacyLessonId[lessonId]);

  const progress = {
    ...originalProgress,
    completedLessonIds,
    startedLessonIds,
    completedStageIds,
    percentage,
  };
  if (currentLessonId) progress.currentLessonId = currentLessonId;
  if (currentTarget) {
    progress.currentStageId = currentTarget.stageId;
    progress.currentAnchor = currentTarget.anchor;
  } else if (currentIsV2 && currentLessonMappings?.[0]) {
    progress.currentStageId = currentLessonMappings[0].stageId;
  }

  const migrated = {
    ...original,
    schemaVersion: ACADEMY_STATE_SCHEMA_VERSION,
    progress,
    migration: {
      id: ACADEMY_STATE_MIGRATION_ID,
      sourceSchemaVersion: Number.isInteger(original.schemaVersion) ? original.schemaVersion : 1,
      targetSchemaVersion: ACADEMY_STATE_SCHEMA_VERSION,
      mapSchemaVersion: map.schemaVersion,
      legacyState: migrationLegacySnapshot(original),
      unmappedCompletedLessonIds,
      unmappedStartedLessonIds,
      ...(originalCurrent && !currentTarget && !currentIsV2 ? { unmappedCurrentLessonId: originalCurrent } : {}),
    },
  };
  if (currentTarget || currentIsV2) migrated.activeLessonId = currentLessonId;
  return migrated;
}

export function isLearningRouteCompleted(state, legacyMap, options) {
  if (!isPlainObject(state)) return false;
  const map = normalizedMap(legacyMap, options);
  const completed = new Set(uniqueStrings(state.progress?.completedLessonIds));
  return map.lessonIds.length > 0 && map.lessonIds.every((lessonId) => completed.has(lessonId));
}

export function isRealOperationCompleted(state) {
  const operation = isPlainObject(state?.operation) ? state.operation : null;
  if (!operation) return false;
  const status = String(operation.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const spainTools = isPlainObject(state?.tools?.spain) ? state.tools.spain : {};
  return ["registered", "matriculado"].includes(status)
    && (operation.registrationAssigned === true || operation.registrationConfirmed === true)
    && (operation.finalFolderCompleted === true || spainTools.finalFolderComplete === true)
    && (operation.closureCompleted === true || operation.closureConfirmed === true);
}

export function completionTransitionEvents(previousState, nextState, legacyMap, { programId = "importa-tu-primer-coche", ...mapOptions } = {}) {
  const events = [];
  if (!isLearningRouteCompleted(previousState, legacyMap, mapOptions) && isLearningRouteCompleted(nextState, legacyMap, mapOptions)) {
    events.push({ event: ACADEMY_COMPLETION_ANALYTICS.learningRoute.event, properties: { programId } });
  }
  if (!isRealOperationCompleted(previousState) && isRealOperationCompleted(nextState)) {
    events.push({ event: ACADEMY_COMPLETION_ANALYTICS.realOperation.event, properties: { programId } });
  }
  return events;
}
