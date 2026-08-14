export const PILOT_SOURCE_ID = "importa-7-dias-final-2026";

export const PILOT_SOURCE_SEGMENT_ASSIGNMENTS = Object.freeze([
  ["importa7-p007-before-search", "importa-7-dias-final-2026:p007:before-search", 7, "lesson-01-01"],
  ["importa7-p008-terrain-overview", "importa-7-dias-final-2026:p008:terrain-overview", 8, "lesson-01-01"],
  ["importa7-p009-germany", "importa-7-dias-final-2026:p009:2.1-germany", 9, "lesson-01-02"],
  ["importa7-p010-netherlands", "importa-7-dias-final-2026:p010:2.2-netherlands", 10, "lesson-01-02"],
  ["importa7-p010-belgium", "importa-7-dias-final-2026:p010:2.3-belgium", 10, "lesson-01-02"],
  ["importa7-p010-france", "importa-7-dias-final-2026:p010:2.4-france", 10, "lesson-01-03"],
  ["importa7-p010-italy-start", "importa-7-dias-final-2026:p010:2.5-italy-start", 10, "lesson-01-03"],
  ["importa7-p011-italy-continuation", "importa-7-dias-final-2026:p011:2.5-italy-continuation", 11, "lesson-01-03"],
  ["importa7-p011-austria", "importa-7-dias-final-2026:p011:2.6-austria", 11, "lesson-01-03"],
  ["importa7-p011-switzerland-norway", "importa-7-dias-final-2026:p011:2.7-switzerland-norway", 11, "lesson-01-03"],
  ["importa7-p011-denmark", "importa-7-dias-final-2026:p011:2.8-denmark", 11, "lesson-01-03"],
  ["importa7-p011-sweden-finland", "importa-7-dias-final-2026:p011:2.9-sweden-finland", 11, "lesson-01-03"],
  ["importa7-p011-portugal", "importa-7-dias-final-2026:p011:2.10-portugal", 11, "lesson-01-03"],
  ["importa7-p012-final-recommendation", "importa-7-dias-final-2026:p012:2.12-final-recommendation", 12, "lesson-01-03"],
].map(([id, coverageKey, page, lessonId]) => Object.freeze({ id, coverageKey, page, lessonId })));

const REQUIRED_SEGMENT_FIELDS = ["id", "coverageKey", "sourceId", "section", "startMarker", "endMarker"];

function fail(errors, message) {
  errors.push(message);
}

export function auditPilotSourceSegments(program) {
  const errors = [];
  const lessonById = new Map((program?.lessons || []).map((lesson) => [lesson.id, lesson]));
  const expectedById = new Map(PILOT_SOURCE_SEGMENT_ASSIGNMENTS.map((segment) => [segment.id, segment]));
  const seenIds = new Map();
  const seenCoverage = new Map();

  for (const lessonId of ["lesson-01-01", "lesson-01-02", "lesson-01-03"]) {
    const lesson = lessonById.get(lessonId);
    if (!lesson) {
      fail(errors, `Falta ${lessonId} para validar sourceSegments.`);
      continue;
    }
    if (!Array.isArray(lesson.sourceSegments) || lesson.sourceSegments.length === 0) {
      fail(errors, `${lessonId}: sourceSegments es obligatorio.`);
      continue;
    }
    for (const segment of lesson.sourceSegments) {
      for (const field of REQUIRED_SEGMENT_FIELDS) {
        if (typeof segment?.[field] !== "string" || !segment[field].trim()) fail(errors, `${lessonId}: segmento sin ${field}.`);
      }
      if (!Number.isInteger(segment?.page)) fail(errors, `${lessonId}:${segment?.id || "segmento"}: page debe ser entero.`);
      if (segment?.sourceId !== PILOT_SOURCE_ID) fail(errors, `${lessonId}:${segment?.id}: sourceId inesperado.`);
      if (!lesson.sourcePages?.includes(segment?.page)) fail(errors, `${lessonId}:${segment?.id}: página ${segment?.page} fuera de sourcePages.`);

      if (seenIds.has(segment?.id)) fail(errors, `Solapamiento accidental: ${segment.id} aparece en ${seenIds.get(segment.id)} y ${lessonId}.`);
      else seenIds.set(segment?.id, lessonId);
      if (seenCoverage.has(segment?.coverageKey)) fail(errors, `Solapamiento accidental: ${segment.coverageKey} aparece en ${seenCoverage.get(segment.coverageKey)} y ${lessonId}.`);
      else seenCoverage.set(segment?.coverageKey, lessonId);

      const expected = expectedById.get(segment?.id);
      if (!expected) {
        fail(errors, `${lessonId}: segmento no previsto ${segment?.id}.`);
        continue;
      }
      if (expected.lessonId !== lessonId) fail(errors, `${segment.id}: asignado a ${lessonId}; debería pertenecer a ${expected.lessonId}.`);
      if (expected.page !== segment.page) fail(errors, `${segment.id}: página ${segment.page}; debería ser ${expected.page}.`);
      if (expected.coverageKey !== segment.coverageKey) fail(errors, `${segment.id}: coverageKey no coincide con el manifiesto.`);
    }

    const expectedPages = [...new Set(PILOT_SOURCE_SEGMENT_ASSIGNMENTS.filter((segment) => segment.lessonId === lessonId).map((segment) => segment.page))];
    if (JSON.stringify(lesson.sourcePages) !== JSON.stringify(expectedPages)) {
      fail(errors, `${lessonId}: sourcePages ${JSON.stringify(lesson.sourcePages)} no coincide con los segmentos ${JSON.stringify(expectedPages)}.`);
    }
  }

  for (const expected of PILOT_SOURCE_SEGMENT_ASSIGNMENTS) {
    if (!seenIds.has(expected.id)) fail(errors, `Segmento sin asignar: ${expected.id}.`);
  }

  const coveredPages = [...new Set(PILOT_SOURCE_SEGMENT_ASSIGNMENTS.map((segment) => segment.page))];
  if (JSON.stringify(coveredPages) !== JSON.stringify([7, 8, 9, 10, 11, 12])) fail(errors, "La cobertura piloto debe abarcar exactamente las páginas 7-12.");

  return {
    ok: errors.length === 0,
    errors,
    lessonCount: 3,
    segmentCount: PILOT_SOURCE_SEGMENT_ASSIGNMENTS.length,
    coveredPages,
  };
}

export function assertPilotSourceSegments(program) {
  const audit = auditPilotSourceSegments(program);
  if (!audit.ok) throw new Error(`Source segments QA:\n- ${audit.errors.join("\n- ")}`);
  return audit;
}
