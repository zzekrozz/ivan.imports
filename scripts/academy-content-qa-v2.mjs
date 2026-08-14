import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertCanonicalMigratedSourceSegments,
  assertFirstMigrationBatchSourceSegments,
  assertFullCanonicalSourceSegments,
  assertPilotSourceSegments,
} from './academy-source-segments.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateRoot = path.join(repo, 'private-products/academy/v2');
const compiledPath = path.join(privateRoot, 'dist/program-v2.json');
const auditPath = path.join(repo, 'private-products/academy/source-audit-2026.json');
const pageTextPath = path.join(repo, 'private-products/academy/page-text.json');
const EXPECTED_SHA256 = '07B2ECBBC28AD0FEF691534AF81CA78D19977D491DEDCBD17A2225DE3E5FECB8';
const EXPECTED_STAGE_COUNTS = [3, 5, 7, 6, 5, 7, 8, 5, 7, 4, 4, 7, 4];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const words = (value) => String(value ?? '').trim().split(/\s+/).filter(Boolean).length;
const countOccurrences = (haystack, needle) => String(haystack).split(needle).length - 1;
const normalizeSourceText = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();

assert(fs.existsSync(compiledPath), `Missing compiled private program: ${compiledPath}`);
const program = readJson(compiledPath);

assert(program.schemaVersion === 2, 'schemaVersion must be 2');
assert(program.id === 'importa-tu-primer-coche', 'program id must remain entitlement-compatible');
assert(program.version === '2026.08-v2', 'unexpected v2 version');
assert(program.access === 'entitlement-required', 'private program must require entitlement');
assert(!Object.hasOwn(program, 'sourceFiles'), 'compiled program must not expose private source file paths');
assert(!JSON.stringify(program).includes('ACADEMY_CONTENT_BLOB_PATHNAME'), 'compiled program must not expose Blob configuration');
assert(!JSON.stringify(program).includes('private-products/academy/v2/'), 'compiled program must not expose repository paths');
assert(program.source?.sha256 === EXPECTED_SHA256, 'source SHA-256 mismatch');
assert(program.source?.pageCount === 150, 'source page count must be 150');
assert(program.source?.edition.toLowerCase() === 'agosto de 2026', 'source edition mismatch');

assert(program.stages.length === 13, `expected 13 stages, got ${program.stages.length}`);
assert(program.lessons.length === 72, `expected 72 lessons, got ${program.lessons.length}`);
assert(program.concepts.length === 317, `expected 317 concepts, got ${program.concepts.length}`);
assert(program.tools.length === 17, `expected 17 tools, got ${program.tools.length}`);
assert(program.videos.length === 40, `expected 40 videos, got ${program.videos.length}`);
assert(program.videos.every((video) => video.status === 'planned' && video.url === null), 'all videos must remain planned without invented URLs');
assert(!program.stages.some((stage) => Object.hasOwn(stage, 'lessons')), 'stages must reference lessonIds and never duplicate lesson bodies');

const lessonById = new Map(program.lessons.map((lesson) => [lesson.id, lesson]));
const conceptById = new Map(program.concepts.map((concept) => [concept.id, concept]));
const stageById = new Map(program.stages.map((stage) => [stage.id, stage]));
assert(lessonById.size === 72, 'lesson ids must be unique');
assert(conceptById.size === 317, 'concept ids must be unique');
const pilotSourceSegmentAudit = assertPilotSourceSegments(program);
const firstBatchSourceSegmentAudit = assertFirstMigrationBatchSourceSegments(program);
assertCanonicalMigratedSourceSegments(program);
const sourceSegmentAudit = assertFullCanonicalSourceSegments(program);

let sourceSegmentMarkers = 'not-present';
if (fs.existsSync(pageTextPath)) {
  const pageText = readJson(pageTextPath).pages || {};
  for (const lessonId of ['lesson-00-01', 'lesson-00-02', 'lesson-00-03', 'lesson-01-01', 'lesson-01-02', 'lesson-01-03']) {
    for (const segment of lessonById.get(lessonId).sourceSegments) {
      const page = normalizeSourceText(pageText[String(segment.page)]);
      const start = normalizeSourceText(segment.startMarker);
      const end = normalizeSourceText(segment.endMarker);
      const startIndex = page.indexOf(start);
      const endIndex = page.indexOf(end);
      assert(startIndex >= 0, `${segment.id}: startMarker not found on page ${segment.page}`);
      assert(endIndex >= 0, `${segment.id}: endMarker not found on page ${segment.page}`);
      assert(startIndex <= endIndex, `${segment.id}: markers are out of order on page ${segment.page}`);
    }
  }
  sourceSegmentMarkers = 'validated-against-page-text';
}
assert(stageById.size === 13, 'stage ids must be unique');

for (let order = 0; order < 13; order += 1) {
  const id = `stage-${String(order).padStart(2, '0')}`;
  const stage = stageById.get(id);
  assert(stage, `missing ${id}`);
  assert(stage.order === order, `${id}: incorrect order`);
  assert(stage.lessonIds.length === EXPECTED_STAGE_COUNTS[order], `${id}: expected ${EXPECTED_STAGE_COUNTS[order]} lessons`);
  assert(stage.kind === (order === 0 ? 'prologue' : 'core'), `${id}: incorrect kind`);
  assert(stage.countsTowardProgress === (order !== 0), `${id}: incorrect progress policy`);
  for (const lessonId of stage.lessonIds) assert(lessonById.get(lessonId)?.stageId === id, `${id}: invalid lesson ${lessonId}`);
}

const allStageLessonIds = program.stages.flatMap((stage) => stage.lessonIds);
assert(allStageLessonIds.length === 72 && new Set(allStageLessonIds).size === 72, 'stage lessonIds must cover 72 lessons exactly once');

const bannedPatterns = [
  /La guía centra/i,
  /se convierte en una decisión comprobable/i,
  /Completa la comprobación práctica/i,
  /Puedo explicar qué resuelve/i,
  /He registrado el resultado o siguiente acción/i,
  /Resolver .+ evita errores/i,
  /Registra en tu operación el resultado/i
];

const conceptResidues = [
  'MI EXPERIENCIA',
  'aprendes todos los pasos a',
  'negociado sin un inglés perf',
  'Tiempo Riesgo Liquidez',
  'RÁPIDO PROFUNDO',
  '45. Revisar la documentación',
  '88. Bélgica',
  '91. Pregunta por las placas',
  'presentar originales + CoC/ficha; No conviertas',
  'Campo editable',
  'CHECKPOINT ·'
];

const genericConceptActionPatterns = [
  /^Sitúa “/u,
  /^Anota el criterio de decisión de “/u,
  /^Aplica “[^”]+”/u,
  /^Clasifica “[^”]+”/u,
  /^Iguala los comparables de “/u,
  /^Formula una pregunta corta sobre “/u,
  /^(?:Confirma|Comprueba|Verifica|Revisa|Coloca|Abre) “[^”]+”/u,
  /^Guarda la evidencia de “/u
];

for (const lesson of program.lessons) {
  const serialized = JSON.stringify(lesson);
  const isCanonicalMigration = lesson.editorialContract?.classification === 'transformacion_fiel';
  assert(['authored', 'reviewed'].includes(lesson.editorialStatus), `${lesson.id}: invalid editorialStatus`);
  assert(lesson.oneSentence && words(lesson.oneSentence) >= (isCanonicalMigration ? 5 : 8), `${lesson.id}: oneSentence is too short`);
  assert(words(lesson.simpleExplanation) >= (isCanonicalMigration ? 5 : 60), `${lesson.id}: simpleExplanation is too short`);
  assert(isCanonicalMigration || words(`${lesson.simpleExplanation} ${lesson.example?.body} ${lesson.commonMistake?.body} ${lesson.actionNow?.body}`) >= 110, `${lesson.id}: authored lesson body is too thin`);
  assert(lesson.actionNow?.body && lesson.actionNow?.output, `${lesson.id}: specific action required`);
  assert(lesson.commonMistake?.body && words(lesson.commonMistake.body) >= (isCanonicalMigration ? 5 : 8), `${lesson.id}: specific mistake required`);
  assert(lesson.example?.body && words(lesson.example.body) >= (isCanonicalMigration ? 5 : 15), `${lesson.id}: specific example required`);
  assert(Array.isArray(lesson.sourcePages) && lesson.sourcePages.length > 0, `${lesson.id}: sourcePages required`);
  assert(lesson.sourcePages.every((page) => Number.isInteger(page) && page >= 1 && page <= 150), `${lesson.id}: source page outside PDF`);
  assert(lesson.sourcePages.every((page) => stageById.get(lesson.stageId).sourcePages.includes(page)), `${lesson.id}: source page outside its stage range`);
  assert(lesson.visual?.purpose && words(lesson.visual.purpose) >= 8, `${lesson.id}: visual purpose required`);
  assert(Array.isArray(lesson.legacyLessonIds) && lesson.legacyLessonIds.length > 0, `${lesson.id}: legacy ids required`);
  assert(Array.isArray(lesson.conceptIds) && lesson.conceptIds.length > 0, `${lesson.id}: concept ids required`);
  assert(lesson.checklist?.length >= 3, `${lesson.id}: at least three specific checks required`);
  assert(lesson.knowledgeCheck?.question && lesson.knowledgeCheck?.answer, `${lesson.id}: knowledge check required`);
  assert(lesson.completion?.doesNotAssertRealOperation === true, `${lesson.id}: learning completion must not assert a real import`);
  for (const pattern of bannedPatterns) assert(!pattern.test(serialized), `${lesson.id}: banned generated prose ${pattern}`);
  for (const conceptId of lesson.conceptIds) assert(conceptById.get(conceptId)?.lessonId === lesson.id, `${lesson.id}: invalid concept ${conceptId}`);
}

assert(program.lessons.filter((lesson) => lesson.example?.body && words(lesson.example.body) >= 15).length >= 50, 'at least 50 lessons need a specific practical example');

for (const concept of program.concepts) {
  const serialized = JSON.stringify(concept);
  const isCanonicalConcept = concept.contentClassification?.shortAnswer === 'transformacion_fiel';
  const normalizedShortAnswer = concept.shortAnswer.trim().toLocaleLowerCase('es');
  const normalizedExplanation = concept.explanation.trim().toLocaleLowerCase('es');
  assert(lessonById.has(concept.lessonId), `${concept.id}: invalid lesson`);
  assert(concept.anchor === concept.id, `${concept.id}: unstable anchor`);
  assert(words(concept.shortAnswer) >= 5, `${concept.id}: shortAnswer too short`);
  assert(concept.shortAnswer.length <= 180, `${concept.id}: shortAnswer exceeds 180 characters`);
  assert(words(concept.explanation) >= 5, `${concept.id}: explanation too short`);
  assert(words(concept.action) >= 5, `${concept.id}: action too short`);
  assert(normalizedShortAnswer !== normalizedExplanation, `${concept.id}: shortAnswer must differ from explanation`);
  assert(!concept.shortAnswer.includes('…') && !concept.shortAnswer.includes('...'), `${concept.id}: truncated shortAnswer`);
  assert(!concept.explanation.includes('…') && !concept.explanation.includes('...'), `${concept.id}: truncated explanation`);
  assert(!concept.action.includes('…') && !concept.action.includes('...'), `${concept.id}: truncated action`);
  if (!isCanonicalConcept) for (const residue of conceptResidues) assert(!serialized.includes(residue), `${concept.id}: mixed-column or next-heading residue: ${residue}`);
  for (const pattern of genericConceptActionPatterns) assert(!pattern.test(concept.action), `${concept.id}: generic concept action template ${pattern}`);
  assert(Array.isArray(concept.sourcePages) && concept.sourcePages.length > 0, `${concept.id}: sourcePages required`);
  for (const pattern of bannedPatterns) assert(!pattern.test(serialized), `${concept.id}: banned generated prose ${pattern}`);
}

assert(new Set(program.concepts.map((concept) => concept.shortAnswer.trim().toLocaleLowerCase('es'))).size === 317, 'concept shortAnswers must be individually authored and unique');

assert(program.legacyLessonMap?.schemaVersion === 2, 'compiled program must contain canonical legacyLessonMap');
assert(program.legacyLessonMap.mappings.length === 317, 'legacy mapping must contain 317 rows');
assert(Object.keys(program.legacyLessonMap.legacyRouteAliases ?? {}).length === 317, 'legacy aliases must contain 317 entries');
assert(new Set(program.legacyLessonMap.mappings.map((mapping) => mapping.legacyLessonId)).size === 317, 'legacy lesson ids must be unique');
assert(new Set(program.legacyLessonMap.mappings.map((mapping) => mapping.lessonId)).size === 72, 'legacy mappings must cover all 72 lessons');
assert(new Set(program.legacyLessonMap.mappings.map((mapping) => mapping.stageId)).size === 13, 'legacy mappings must cover all 13 stages');
assert(program.searchIndex.filter((entry) => entry.kind === 'concept').length === 317, 'search index must expose all 317 concepts');
assert(new Set(program.searchIndex.filter((entry) => entry.kind === 'concept').map((entry) => entry.anchor)).size === 317, 'concept search anchors must be unique');
for (const mapping of program.legacyLessonMap.mappings) {
  const lesson = lessonById.get(mapping.lessonId);
  const concept = conceptById.get(mapping.conceptId);
  const alias = program.legacyLessonMap.legacyRouteAliases[mapping.legacyLessonId];
  assert(lesson?.stageId === mapping.stageId, `${mapping.legacyLessonId}: stage mismatch`);
  assert(lesson?.slug === mapping.lessonSlug, `${mapping.legacyLessonId}: slug mismatch`);
  assert(concept?.lessonId === mapping.lessonId && concept.anchor === mapping.anchor, `${mapping.legacyLessonId}: concept/anchor mismatch`);
  assert(alias?.lessonId === mapping.lessonId && alias?.anchor === mapping.anchor, `${mapping.legacyLessonId}: alias mismatch`);
}

assert(sourceSegmentAudit.segmentCount === 199, 'canonical map must contain 199 exact source segments');
assert(sourceSegmentAudit.coveredPages.length === 150, 'canonical map must cover all 150 PDF pages');
assert(sourceSegmentAudit.classifiedLessons === 66, 'all 66 migrated lessons must classify non-literal layers');

const dgtFact = program.contentFacts.find((fact) => fact.id === 'dgt-tasa-1-1-2026');
assert(dgtFact?.value === 99.77 && dgtFact.status === 'verify-before-use', 'DGT fee must be 99.77 EUR and verify-before-use');
assert(program.contentFacts.filter((fact) => typeof fact.value === 'number' || typeof fact.value === 'object').every((fact) => fact.status === 'verify-before-use' || fact.id === 'formula-combustible' || fact.id === 'formula-precio-maximo' || fact.id === 'formula-roi'), 'mutable numeric facts must be marked for verification');

assert(program.completionSemantics?.learning?.message === 'HAS COMPLETADO LA RUTA.', 'learning completion copy mismatch');
assert(program.completionSemantics?.realOperation?.message === 'FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.', 'real-operation completion copy mismatch');
assert(program.completionSemantics?.realOperation?.neverInferFromLearningProgress === true, 'real operation must never be inferred from lesson progress');
assert(countOccurrences(JSON.stringify(program.completionSemantics), 'FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.') === 1, 'real-operation completion copy must be canonical');

let auditResult = 'not-present';
if (fs.existsSync(auditPath)) {
  const audit = readJson(auditPath);
  assert(audit.source?.sha256 === EXPECTED_SHA256, 'source audit SHA-256 mismatch');
  assert(audit.source?.pageCount === 150, 'source audit page count mismatch');
  assert(Array.isArray(audit.pages) && audit.pages.length === 150, 'source audit must contain 150 pages');
  const pageNumbers = new Set();
  for (const page of audit.pages) {
    assert(Number.isInteger(page.number) && page.number >= 1 && page.number <= 150, 'source audit page number invalid');
    pageNumbers.add(page.number);
    for (const field of ['title', 'sections', 'visualElements', 'tables', 'images', 'credits', 'concepts', 'relatedLessonIds']) {
      assert(Object.hasOwn(page, field), `source audit page ${page.number}: missing ${field}`);
    }
    assert(Array.isArray(page.sections), `source audit page ${page.number}: sections must be an array`);
    assert(Array.isArray(page.visualElements), `source audit page ${page.number}: visualElements must be an array`);
    assert(Array.isArray(page.tables), `source audit page ${page.number}: tables must be an array`);
    assert(page.images && typeof page.images === 'object', `source audit page ${page.number}: images must be an object`);
    assert(Array.isArray(page.credits), `source audit page ${page.number}: credits must be an array`);
    assert(Array.isArray(page.concepts), `source audit page ${page.number}: concepts must be an array`);
    assert(Array.isArray(page.relatedLessonIds), `source audit page ${page.number}: relatedLessonIds must be an array`);
    for (const lessonId of page.relatedLessonIds) assert(lessonById.has(lessonId), `source audit page ${page.number}: invalid lesson ${lessonId}`);
  }
  assert(pageNumbers.size === 150, 'source audit page numbers must be unique');
  auditResult = 'validated-150-pages';
}

console.log(JSON.stringify({
  status: 'ok',
  programId: program.id,
  schemaVersion: program.schemaVersion,
  stages: program.stages.length,
  lessons: program.lessons.length,
  concepts: program.concepts.length,
  mappings: program.legacyLessonMap.mappings.length,
  purposefulVisuals: program.lessons.filter((lesson) => lesson.visual?.purpose).length,
  practicalExamples: program.lessons.filter((lesson) => words(lesson.example?.body) >= 15).length,
  videosPlanned: program.videos.filter((video) => video.status === 'planned').length,
  sourceSegments: sourceSegmentAudit.segmentCount,
  sourceSegmentPages: sourceSegmentAudit.coveredPages,
  sourceSegmentSectionMappings: sourceSegmentAudit.sectionMappingCount,
  sourceSegmentVisualMappings: sourceSegmentAudit.visualMappingCount,
  sourceSegmentEditorialIdeas: sourceSegmentAudit.editorialIdeaCount,
  classifiedCanonicalLessons: sourceSegmentAudit.classifiedLessons,
  canonicalPdfSha256: sourceSegmentAudit.canonicalPdfSha256,
  pilotSourceSegments: pilotSourceSegmentAudit.segmentCount,
  firstBatchSourceSegments: firstBatchSourceSegmentAudit.segmentCount,
  firstBatchSourceSegmentPages: firstBatchSourceSegmentAudit.coveredPages,
  sourceSegmentMarkers,
  sourceAudit: auditResult
}, null, 2));
