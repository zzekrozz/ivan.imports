const EXPECTED = Object.freeze({ stages: 13, lessons: 72, concepts: 317, tools: 17 });
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLISHABLE_EDITORIAL_STATUSES = new Set(["authored", "reviewed"]);

function assert(condition, message) {
  if (!condition) throw new Error(`Academy public catalog validation failed: ${message}`);
}

function unique(items, label) {
  assert(items.every((item) => typeof item === "string" && item.length > 0), `${label} must be non-empty strings`);
  assert(new Set(items).size === items.length, `${label} must be unique`);
}

export function validatePublicAcademyCatalog(program) {
  assert(program && typeof program === "object" && !Array.isArray(program), "catalog must be an object");
  assert(program.schemaVersion === 2, "schemaVersion must be 2");
  assert(program.id === "importa-tu-primer-coche", "program id must remain importa-tu-primer-coche");
  assert(program.access === "public-free", "access must be public-free");
  assert(program.publicPath === "/academia/", "publicPath must be /academia/");
  assert(program.publicRelease?.registrationRequired === false, "registration must not be required");
  assert(program.publicRelease?.paymentRequired === false, "payment must not be required");

  for (const [key, expected] of Object.entries(EXPECTED)) {
    assert(Array.isArray(program[key]), `${key} must be an array`);
    assert(program[key].length === expected, `${key} must contain ${expected} entries`);
  }
  for (const key of ["resources", "videos", "faqs", "answers", "glossary", "searchIndex"]) {
    assert(Array.isArray(program[key]), `${key} must be an array`);
  }

  const stageIds = program.stages.map((stage) => stage.id);
  const lessonIds = program.lessons.map((lesson) => lesson.id);
  const conceptIds = program.concepts.map((concept) => concept.id);
  const toolIds = program.tools.map((tool) => tool.id);
  unique(stageIds, "stage ids");
  unique(lessonIds, "lesson ids");
  unique(conceptIds, "concept ids");
  unique(toolIds, "tool ids");
  unique(program.stages.map((stage) => stage.slug), "stage slugs");
  unique(program.lessons.map((lesson) => lesson.slug), "lesson slugs");
  unique(program.tools.map((tool) => tool.slug), "tool slugs");

  const stages = new Map(program.stages.map((stage) => [stage.id, stage]));
  const lessons = new Map(program.lessons.map((lesson) => [lesson.id, lesson]));
  const concepts = new Map(program.concepts.map((concept) => [concept.id, concept]));
  const tools = new Map(program.tools.map((tool) => [tool.id, tool]));

  for (let order = 0; order < EXPECTED.stages; order += 1) {
    const id = `stage-${String(order).padStart(2, "0")}`;
    const stage = stages.get(id);
    assert(stage?.order === order, `${id} is missing or out of order`);
    assert(SLUG_PATTERN.test(stage.slug), `${id} has an invalid slug`);
    assert(Array.isArray(stage.lessonIds) && stage.lessonIds.length > 0, `${id} must reference lessons`);
    unique(stage.lessonIds, `${id} lesson ids`);
    for (const lessonId of stage.lessonIds) {
      assert(lessons.get(lessonId)?.stageId === id, `${id} references an invalid lesson ${lessonId}`);
    }
  }
  const orderedLessonIds = program.stages.flatMap((stage) => stage.lessonIds);
  assert(orderedLessonIds.length === EXPECTED.lessons, "stage lesson references must total 72");
  assert(new Set(orderedLessonIds).size === EXPECTED.lessons, "every lesson must belong to exactly one stage");

  for (const lesson of program.lessons) {
    assert(/^lesson-\d{2}-\d{2}$/.test(lesson.id), `${lesson.id} has an invalid id`);
    assert(SLUG_PATTERN.test(lesson.slug), `${lesson.id} has an invalid slug`);
    assert(stages.has(lesson.stageId), `${lesson.id} references an invalid stage`);
    assert(PUBLISHABLE_EDITORIAL_STATUSES.has(lesson.editorialStatus), `${lesson.id} is not publishable`);
    assert(Array.isArray(lesson.conceptIds) && lesson.conceptIds.length > 0, `${lesson.id} must reference concepts`);
    unique(lesson.conceptIds, `${lesson.id} concept ids`);
    for (const conceptId of lesson.conceptIds) {
      assert(concepts.get(conceptId)?.lessonId === lesson.id, `${lesson.id} references an invalid concept ${conceptId}`);
    }
    for (const toolId of lesson.toolIds ?? []) assert(tools.has(toolId), `${lesson.id} references an invalid tool ${toolId}`);
  }

  for (const concept of program.concepts) {
    assert(/^concept-[a-z0-9-]+$/.test(concept.id), `${concept.id} has an invalid id`);
    assert(lessons.has(concept.lessonId), `${concept.id} references an invalid lesson`);
    assert(concept.anchor === concept.id, `${concept.id} has an unstable anchor`);
  }
  for (const tool of program.tools) {
    assert(SLUG_PATTERN.test(tool.slug), `${tool.id} has an invalid slug`);
    assert(stages.has(tool.stageId), `${tool.id} references an invalid stage`);
  }

  const legacyMap = program.legacyLessonMap;
  assert(legacyMap?.schemaVersion === 2, "legacyLessonMap schemaVersion must be 2");
  assert(Array.isArray(legacyMap.mappings) && legacyMap.mappings.length === EXPECTED.concepts, "legacy mappings must contain 317 rows");
  assert(legacyMap.legacyRouteAliases && typeof legacyMap.legacyRouteAliases === "object", "legacy aliases must be an object");
  assert(Object.keys(legacyMap.legacyRouteAliases).length === EXPECTED.concepts, "legacy aliases must contain 317 rows");
  unique(legacyMap.mappings.map((mapping) => mapping.legacyLessonId), "legacy lesson ids");
  for (const mapping of legacyMap.mappings) {
    const lesson = lessons.get(mapping.lessonId);
    const concept = concepts.get(mapping.conceptId);
    const alias = legacyMap.legacyRouteAliases[mapping.legacyLessonId];
    assert(lesson?.stageId === mapping.stageId, `${mapping.legacyLessonId} has an invalid stage`);
    assert(lesson?.slug === mapping.lessonSlug, `${mapping.legacyLessonId} has an invalid lesson slug`);
    assert(concept?.lessonId === mapping.lessonId && concept.anchor === mapping.anchor, `${mapping.legacyLessonId} has an invalid concept anchor`);
    assert(alias?.lessonId === mapping.lessonId && alias?.anchor === mapping.anchor, `${mapping.legacyLessonId} has an invalid alias`);
  }

  const serialized = JSON.stringify(program);
  for (const forbidden of ["privateDelivery", "private-products/", "ACADEMY_CONTENT_BLOB_PATHNAME", "BLOB_READ_WRITE_TOKEN", "entitlement-required"]) {
    assert(!serialized.includes(forbidden), `catalog contains forbidden private marker ${forbidden}`);
  }
  assert(!Object.hasOwn(program, "sourceFiles"), "catalog must not expose editorial source files");

  return program;
}
