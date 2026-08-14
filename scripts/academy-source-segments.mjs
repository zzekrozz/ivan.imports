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

export const FIRST_BATCH_SOURCE_SEGMENT_ASSIGNMENTS = Object.freeze([
  ["importa7-p001-full-page", "importa-7-dias-final-2026:p001:full-page", 1, "lesson-00-01"],
  ["importa7-p002-full-page", "importa-7-dias-final-2026:p002:full-page", 2, "lesson-00-01"],
  ["importa7-p003-full-page", "importa-7-dias-final-2026:p003:full-page", 3, "lesson-00-01"],
  ["importa7-p004-full-page", "importa-7-dias-final-2026:p004:full-page", 4, "lesson-00-01"],
  ["importa7-p005-guide-not-memory", "importa-7-dias-final-2026:p005:guide-not-memory", 5, "lesson-00-02"],
  ["importa7-p005-four-information-types", "importa-7-dias-final-2026:p005:four-information-types", 5, "lesson-00-02"],
  ["importa7-p005-how-to-use-in-practice", "importa-7-dias-final-2026:p005:how-to-use-in-practice", 5, "lesson-00-02"],
  ["importa7-p145-workbook-templates-live-apart", "importa-7-dias-final-2026:p145:workbook-templates-live-apart", 145, "lesson-00-02"],
  ["importa7-p146-quick-glossary", "importa-7-dias-final-2026:p146:quick-glossary", 146, "lesson-00-02"],
  ["importa7-p148-official-sources-and-reference", "importa-7-dias-final-2026:p148:official-sources-and-reference", 148, "lesson-00-02"],
  ["importa7-p149-visual-credits", "importa-7-dias-final-2026:p149:visual-credits", 149, "lesson-00-02"],
  ["importa7-p005-method-limit", "importa-7-dias-final-2026:p005:method-limit", 5, "lesson-00-03"],
  ["importa7-p006-full-page", "importa-7-dias-final-2026:p006:full-page", 6, "lesson-00-03"],
  ["importa7-p147-cases-requiring-review", "importa-7-dias-final-2026:p147:cases-requiring-review", 147, "lesson-00-03"],
].map(([id, coverageKey, page, lessonId]) => Object.freeze({ id, coverageKey, page, lessonId })));

export const FIRST_BATCH_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS = Object.freeze({
  "importa7-p001-full-page": Object.freeze([
    "Importa tu coche en 7 días",
    "buscar, comprobar, comprar, traer y matricular",
    "desde Europa hasta España",
    "Más de 7 años de experiencia",
    "método práctico",
  ]),
  "importa7-p002-full-page": Object.freeze([
    "Guía práctica de búsqueda, compra, viaje, comprobación, ITV y matriculación en España",
    "agosto de 2026",
    "vehículos usados procedentes principalmente de la Unión Europea",
    "Alemania, Países Bajos y Bélgica",
    "experiencia real + procedimientos oficiales + herramientas de trabajo",
    "pueden cambiar",
    "Comprueba las fuentes oficiales",
    "Todos los derechos reservados",
  ]),
  "importa7-p003-full-page": Object.freeze([
    "No quiero que memorices un manual",
    "sistema al que volver",
    "más de siete años",
    "jornadas enteras buscando anuncios",
    "he volado para ver coches que parecían perfectos y no lo eran",
    "he negociado sin un inglés perfecto",
    "he vuelto conduciendo miles de kilómetros",
    "he perdido fines de semana",
    "vendedores sinceros",
    "rutas bien organizadas",
    "margen suficiente para solucionar una avería",
    "La primera importación parece enorme",
    "las siguientes se vuelven muchísimo más sencillas",
    "acortar esa primera curva",
    "Trámites oficiales",
    "horas de búsqueda, llamadas, dudas, viajes, errores, hoteles, peajes, documentación y pequeños trucos",
    "ENTENDER",
    "Ver el proceso completo sin niebla",
    "DECIDIR",
    "Descartar operaciones que no merecen la pena",
    "EJECUTAR",
    "Usar el curso mientras haces tu primera importación",
  ]),
  "importa7-p004-full-page": Object.freeze([
    "Todo lo que vas a aprender",
    "mismo orden en el que ocurre una operación real",
    "Países",
    "Buscar",
    "Filtrar",
    "Leer anuncio",
    "Comparar España",
    "Coste total",
    "Vendedor",
    "Documentos",
    "Negociar",
    "Viaje",
    "Revisar",
    "Comprar",
    "Volver",
    "ITV",
    "DGT",
    "Conocer todas las piezas",
    "El método de los 7 días",
    "anticipar bloqueos",
    "hacer varias tareas en paralelo",
    "Los 7 días no son una promesa",
    "El banco, el vendedor, la ITV o DGT pueden retrasarte",
    "qué reservar, qué adelantar y qué no dejar para un viernes",
    "Ahora entiendo el proceso",
    "Podría hacerlo yo",
  ]),
  "importa7-p005-guide-not-memory": Object.freeze([
    "Una guía para consultar, no para memorizar",
    "El contenido principal explica el proceso completo con ejemplos y experiencia",
    "Las hojas operativas viven en un cuaderno de trabajo separado",
    "Explicación, ejemplos, decisiones, fotografías, tablas, procesos y casos prácticos",
    "Presupuesto, candidato, mercado, preguntas, Plan A/B/C, inspección, costes, ITV y DGT",
  ]),
  "importa7-p005-four-information-types": Object.freeze([
    "Experiencia personal",
    "Lo que he vivido, hago habitualmente o he observado en operaciones reales",
    "Una recomendación nacida de la práctica",
    "Regla oficial",
    "Un requisito de DGT, AEAT, BOE, ITV u otra administración",
    "Comprueba siempre la versión vigente",
    "Recomendación",
    "Una forma de reducir riesgo o ganar tiempo",
    "Puede haber otras maneras válidas",
    "Cálculo rápido",
    "Una aproximación para decidir si merece la pena seguir investigando",
    "No sustituye el cálculo final",
  ]),
  "importa7-p005-how-to-use-in-practice": Object.freeze([
    "Cómo usarlo en la práctica",
    "abre el capítulo que corresponda al momento de la operación",
    "No necesitas acordarte de todo",
    "Necesitas saber dónde volver a mirar",
  ]),
  "importa7-p145-workbook-templates-live-apart": Object.freeze([
    "Las plantillas útiles viven aparte",
    "duplicarlo por cada vehículo",
    "Presupuesto inicial",
    "Filtros y búsquedas",
    "Vehículo candidato",
    "Mercado español",
    "Preguntas / llamada",
    "Plan A/B/C",
    "Coste total",
    "Inspección",
    "Documentación",
    "España y 7 días",
    "guarda una copia por coche",
    "Comparar el estimado con el coste real",
  ]),
  "importa7-p146-quick-glossary": Object.freeze([
    "CoC",
    "Certificado de conformidad europeo del vehículo",
    "Ficha reducida",
    "VIN / bastidor",
    "V.7",
    "Campo K",
    "TÜV / HU",
    "Teil I / Teil II",
    "Motorschaden",
    "Getriebeschaden",
    "Unfallfrei",
    "Placas de exportación",
    "IVTM",
    "Modelo 576",
    "ROI",
    "beneficio ÷ inversión total × 100",
  ]),
  "importa7-p148-official-sources-and-reference": Object.freeze([
    "Comprueba siempre la versión vigente antes de ejecutar",
    "Las tasas, formularios y procedimientos pueden cambiar",
    "DGT",
    "Agencia Tributaria",
    "BOE",
    "Ministerio de Industria",
    "RDW",
    "Movilidad Bélgica",
    "Administración alemana",
    "usa este curso para saber qué buscar y qué preguntar",
    "fuente oficial para confirmar el importe y procedimiento exactos",
  ]),
  "importa7-p149-visual-credits": Object.freeze([
    "Imágenes utilizadas con intención, no para rellenar",
    "Capturas de portales y anuncios",
    "Fotografías propias",
    "Fotografías editoriales",
    "Placa alemana de exportación",
    "Gráficos e infografías",
    "Pexels",
    "Wikimedia Commons",
    "explica, compara, contextualiza o ayuda a recordar",
    "Si no aporta, sobra",
  ]),
  "importa7-p005-method-limit": Object.freeze([
    "Límite del método",
    "usados con documentación europea",
    "homologación que permita matricularlos en España",
    "EE. UU., Canadá, terceros países o reformas complejas",
    "requieren más revisión",
  ]),
  "importa7-p006-full-page": Object.freeze([
    "ÍNDICE ORIENTADO A RESULTADO",
    "Antes de buscar",
    "Encontrar el vehículo",
    "Leer el anuncio",
    "Comparar con España",
    "Saber si merece la pena",
    "Hablar y negociar",
    "Organizar el viaje",
    "Revisar el vehículo",
    "Comprar y salir",
    "La vuelta",
    "Ya en España",
    "El método de los 7 días",
    "Checklists, glosario y fuentes",
    "Referencia rápida para futuras operaciones",
  ]),
  "importa7-p147-cases-requiring-review": Object.freeze([
    "Saber frenar también forma parte de saber importar",
    "Campo K vacío o formato no europeo",
    "Confirma la vía de homologación",
    "Origen EE. UU. o Canadá",
    "Historial norteamericano, millas, luces distintas",
    "Reformas importantes",
    "Suspensión, escape, plazas, bola, iluminación o medidas",
    "Vehículo de carga antiguo",
    "furgonetas anteriores a 2012",
    "Fuera de la UE",
    "Aduanas, IVA de importación y posible arancel",
    "VIN o documentos incoherentes",
    "no pagues hasta aclararlo",
    "No es saber menos",
    "te evita pagar por aprender el problema después",
  ]),
});

export const CANONICAL_MIGRATED_SOURCE_SEGMENT_ASSIGNMENTS = Object.freeze([
  ...FIRST_BATCH_SOURCE_SEGMENT_ASSIGNMENTS,
  ...PILOT_SOURCE_SEGMENT_ASSIGNMENTS,
]);

export const CANONICAL_MIGRATED_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS = Object.freeze({
  ...FIRST_BATCH_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
  ...PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
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

function auditSourceSegmentScope(program, { assignments, expectations, lessonIds, requiredPages, scopeLabel }) {
  const errors = [];
  const lessonById = new Map((program?.lessons || []).map((lesson) => [lesson.id, lesson]));
  const expectedById = new Map(assignments.map((segment) => [segment.id, segment]));
  const seenIds = new Map();
  const seenCoverage = new Map();
  let sectionMappingCount = 0;
  let visualMappingCount = 0;
  let editorialIdeaCount = 0;

  for (const lessonId of lessonIds) {
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

    const expectedPages = [...new Set(assignments.filter((segment) => segment.lessonId === lessonId).map((segment) => segment.page))];
    if (JSON.stringify(lesson.sourcePages) !== JSON.stringify(expectedPages)) {
      fail(errors, `${lessonId}: sourcePages ${JSON.stringify(lesson.sourcePages)} no coincide con los segmentos ${JSON.stringify(expectedPages)}.`);
    }

    const ownedSegmentIds = new Set(assignments.filter((segment) => segment.lessonId === lessonId).map((segment) => segment.id));
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
      const segmentExpectations = expectations[segmentId] || [];
      editorialIdeaCount += segmentExpectations.length;
      for (const idea of segmentExpectations) {
        if (!mappedEditorialText.includes(normalizeEditorialText(idea))) {
          fail(errors, `${lessonId}:${segmentId}: falta contenido editorial requerido: ${idea}`);
        }
      }
    }
  }

  for (const expected of assignments) {
    if (!seenIds.has(expected.id)) fail(errors, `Segmento sin asignar: ${expected.id}.`);
  }

  const coveredPages = [...new Set(assignments.map((segment) => segment.page))].sort((a, b) => a - b);
  if (JSON.stringify(coveredPages) !== JSON.stringify(requiredPages)) {
    fail(errors, `${scopeLabel}: cobertura ${JSON.stringify(coveredPages)}; se esperaba ${JSON.stringify(requiredPages)}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    lessonCount: lessonIds.length,
    segmentCount: assignments.length,
    coveredPages,
    sectionMappingCount,
    visualMappingCount,
    editorialIdeaCount,
  };
}

export function auditPilotSourceSegments(program) {
  return auditSourceSegmentScope(program, {
    assignments: PILOT_SOURCE_SEGMENT_ASSIGNMENTS,
    expectations: PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
    lessonIds: ["lesson-01-01", "lesson-01-02", "lesson-01-03"],
    requiredPages: [7, 8, 9, 10, 11, 12],
    scopeLabel: "Unidad piloto",
  });
}

export function auditFirstMigrationBatchSourceSegments(program) {
  return auditSourceSegmentScope(program, {
    assignments: FIRST_BATCH_SOURCE_SEGMENT_ASSIGNMENTS,
    expectations: FIRST_BATCH_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
    lessonIds: ["lesson-00-01", "lesson-00-02", "lesson-00-03"],
    requiredPages: [1, 2, 3, 4, 5, 6, 145, 146, 147, 148, 149],
    scopeLabel: "Primer lote de migración",
  });
}

export function auditCanonicalMigratedSourceSegments(program) {
  return auditSourceSegmentScope(program, {
    assignments: CANONICAL_MIGRATED_SOURCE_SEGMENT_ASSIGNMENTS,
    expectations: CANONICAL_MIGRATED_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
    lessonIds: ["lesson-00-01", "lesson-00-02", "lesson-00-03", "lesson-01-01", "lesson-01-02", "lesson-01-03"],
    requiredPages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 145, 146, 147, 148, 149],
    scopeLabel: "Contenido canónico migrado",
  });
}

export function assertPilotSourceSegments(program) {
  const audit = auditPilotSourceSegments(program);
  if (!audit.ok) throw new Error(`Source segments QA:\n- ${audit.errors.join("\n- ")}`);
  return audit;
}

export function assertFirstMigrationBatchSourceSegments(program) {
  const audit = auditFirstMigrationBatchSourceSegments(program);
  if (!audit.ok) throw new Error(`First migration batch source segments QA:\n- ${audit.errors.join("\n- ")}`);
  return audit;
}

export function assertCanonicalMigratedSourceSegments(program) {
  const audit = auditCanonicalMigratedSourceSegments(program);
  if (!audit.ok) throw new Error(`Canonical migrated source segments QA:\n- ${audit.errors.join("\n- ")}`);
  return audit;
}
