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

export const PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS = Object.freeze({
  "importa7-p007-before-search": Object.freeze([
    "Empezamos despacio",
    "PROCESO → PAÍS → PRESUPUESTO → BÚSQUEDA",
  ]),
  "importa7-p008-terrain-overview": Object.freeze([
    "No buscamos el país con un anuncio barato",
    "Alemania",
    "Países Bajos",
    "Bélgica",
    "Mi recomendación para tu primera importación",
    "Mercado",
    "Transparencia",
    "Salida del país",
    "Riesgo añadido",
    "Después vendrá el presupuesto",
  ]),
  "importa7-p009-germany": Object.freeze([
    "Alemania: mi TOP 1",
    "cantidad enorme de vehículos",
    "vendedores acostumbrados a exportar",
    "proceso de placas de exportación",
    "Piratas",
    "vienes desde España",
    "volver conduciendo",
    "mucha sinceridad",
    "WhatsApp",
    "el mismo día o para el siguiente",
    "confirmarlo antes de comprar el vuelo",
    "región",
    "horario",
    "primera opción por equilibrio",
    "no convierte cualquier coche alemán en una buena compra",
  ]),
  "importa7-p010-netherlands": Object.freeze([
    "una de mis alternativas favoritas",
    "sistema de exportación organizado",
    "llegaron originalmente desde Alemania",
    "RDW",
    "certificado de exportación",
    "capa adicional",
    "No sustituye el historial, la documentación ni la inspección",
  ]),
  "importa7-p010-belgium": Object.freeze([
    "muchísimo mercado",
    "2dehands.be",
    "particulares",
    "profesionales",
    "placas X",
    "residencia fuera de Bélgica",
    "documentación original",
    "seguro",
    "inspección técnica",
    "compraventa acostumbrada a exportar",
  ]),
  "importa7-p010-france": Object.freeze([
    "menos oportunidades",
    "modelos alemanes",
    "vehículos franceses",
    "Peugeot, Citroën y Renault",
    "Citroën Jumper",
    "Peugeot Boxer",
    "Renault Master",
    "Citroën Jumpy",
    "Peugeot Expert",
    "procedimiento detallado de exportación francés",
    "ejecutado de principio a fin",
    "experiencia que no tengo",
  ]),
  "importa7-p010-italy-start": Object.freeze([
    "Italia mediante subasta",
    "no voy a afirmar cómo funciona en la práctica",
    "gestión de placas",
    "directamente a un concesionario",
  ]),
  "importa7-p011-italy-continuation": Object.freeze([
    "Los precios pueden ser interesantes",
    "para una primera importación",
    "mercado cuyo proceso conozco mejor",
  ]),
  "importa7-p011-austria": Object.freeze([
    "Nunca he comprado allí",
    "óxido",
    "clima, nieve y sal",
    "No significa que todos los coches estén oxidados",
    "bajos y la corrosión",
  ]),
  "importa7-p011-switzerland-norway": Object.freeze([
    "Suiza y Noruega",
    "fuera de la Unión Europea",
    "aduanas",
    "IVA de importación",
    "derechos arancelarios",
    "no complicarse",
    "coche comunitario",
  ]),
  "importa7-p011-denmark": Object.freeze([
    "primer coche que importé",
    "Synsrapport",
    "servicios públicos",
    "inspecciones y datos",
    "información gratuita útil",
    "kilometrajes muy altos",
    "furgoneta o dos plazas",
    "configuración real",
    "configuraciones comerciales",
    "pagar menos impuestos locales",
    "turismo normal de cinco plazas",
    "categoría y el número de plazas",
  ]),
  "importa7-p011-sweden-finland": Object.freeze([
    "Suecia y Finlandia",
    "óxido, uso intensivo y configuraciones comerciales",
    "no tengo experiencia suficiente",
    "estrategia concreta",
    "Prefiero decirlo claramente",
  ]),
  "importa7-p011-portugal": Object.freeze([
    "precios más altos que en España",
    "unidad interesante",
    "gran diferencia de precio",
  ]),
  "importa7-p012-final-recommendation": Object.freeze([
    "Empieza donde haya menos fricción",
    "El mejor equilibrio general para empezar",
    "Mercado amplio y exportación organizada",
    "Mucha oferta y buena alternativa geográfica",
    "sin abrir quince países a la vez",
    "Como máximo, ampliaría a Países Bajos y Bélgica",
    "El país no compra el coche por ti",
    "Un coche alemán también puede estar mal",
    "uno de otro mercado puede ser excelente",
    "comprobar, exportar y reaccionar con menos fricción",
    "Siguiente paso",
  ]),
});

const REQUIRED_SEGMENT_FIELDS = ["id", "coverageKey", "sourceId", "section", "startMarker", "endMarker"];

const normalizeEditorialText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/\s+/g, " ")
  .trim();

function fail(errors, message) {
  errors.push(message);
}

export function auditPilotSourceSegments(program) {
  const errors = [];
  const lessonById = new Map((program?.lessons || []).map((lesson) => [lesson.id, lesson]));
  const expectedById = new Map(PILOT_SOURCE_SEGMENT_ASSIGNMENTS.map((segment) => [segment.id, segment]));
  const seenIds = new Map();
  const seenCoverage = new Map();
  let sectionMappingCount = 0;
  let visualMappingCount = 0;
  let editorialIdeaCount = 0;

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

    const ownedSegmentIds = new Set(PILOT_SOURCE_SEGMENT_ASSIGNMENTS.filter((segment) => segment.lessonId === lessonId).map((segment) => segment.id));
    const editorialTextBySegment = new Map([...ownedSegmentIds].map((segmentId) => [segmentId, []]));
    for (const section of lesson.sections || []) {
      const sourceSegmentIds = Array.isArray(section.sourceSegmentIds) ? section.sourceSegmentIds : [];
      if (sourceSegmentIds.length === 0) {
        fail(errors, `${lessonId}:${section.id || "sección"}: sourceSegmentIds es obligatorio.`);
        continue;
      }
      for (const segmentId of sourceSegmentIds) {
        sectionMappingCount += 1;
        if (!ownedSegmentIds.has(segmentId)) {
          fail(errors, `${lessonId}:${section.id || "sección"}: ${segmentId} está fuera de su hogar canónico.`);
          continue;
        }
        editorialTextBySegment.get(segmentId).push(JSON.stringify(section));
      }
    }

    for (const visual of lesson.visuals || []) {
      const sourceSegmentIds = Array.isArray(visual.sourceSegmentIds) ? visual.sourceSegmentIds : [];
      if (sourceSegmentIds.length === 0) {
        fail(errors, `${lessonId}:${visual.id || "visual"}: sourceSegmentIds es obligatorio.`);
        continue;
      }
      for (const segmentId of sourceSegmentIds) {
        visualMappingCount += 1;
        if (!ownedSegmentIds.has(segmentId)) {
          fail(errors, `${lessonId}:${visual.id || "visual"}: ${segmentId} está fuera de su hogar canónico.`);
          continue;
        }
        editorialTextBySegment.get(segmentId).push(JSON.stringify(visual));
      }
    }

    for (const segmentId of ownedSegmentIds) {
      const mappedEditorialText = normalizeEditorialText(editorialTextBySegment.get(segmentId).join(" "));
      if (!mappedEditorialText) fail(errors, `${lessonId}: ${segmentId} no tiene contenido editorial asignado.`);
      const expectations = PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS[segmentId] || [];
      editorialIdeaCount += expectations.length;
      for (const idea of expectations) {
        if (!mappedEditorialText.includes(normalizeEditorialText(idea))) {
          fail(errors, `${lessonId}:${segmentId}: falta contenido editorial requerido: ${idea}`);
        }
      }
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
    sectionMappingCount,
    visualMappingCount,
    editorialIdeaCount,
  };
}

export function assertPilotSourceSegments(program) {
  const audit = auditPilotSourceSegments(program);
  if (!audit.ok) throw new Error(`Source segments QA:\n- ${audit.errors.join("\n- ")}`);
  return audit;
}
