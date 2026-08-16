import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const privateProgramPath = path.join(root, "private-products/academy/v2/dist/program-v2.json");
const privateConceptsPath = path.join(root, "private-products/academy/v2/concepts/concepts.json");
const privateReady = fs.existsSync(privateProgramPath) && fs.existsSync(privateConceptsPath);
const program = privateReady ? read("private-products/academy/v2/dist/program-v2.json") : null;
const sourceConcepts = privateReady ? read("private-products/academy/v2/concepts/concepts.json").concepts : [];

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const GLOSSARY_SIGNALS = Object.freeze({
  coc: /\bcoc\b|certificado de conformidad/,
  "ficha-reducida": /ficha reducida|\bficha\b/,
  vin: /\bvin\b|bastidor/,
  v7: /\bv\.?7\b|emisiones|\bco2\b/,
  "campo-k": /campo k|homologacion|\bk\b/,
  "tuv-hu": /\btuv\b|\bhu\b|inspeccion tecnica alemana/,
  "teil-i-ii": /teil i|teil ii/,
  motorschaden: /motorschaden|averia de motor/,
  getriebeschaden: /getriebeschaden|caja de cambios/,
  unfallfrei: /unfallfrei|libre de accidentes/,
  "placas-exportacion": /placas? de exportacion|placas?.*(salida|regreso)|matricula temporal/,
  ivtm: /\bivtm\b|impuesto de circulacion/,
  "modelo-576": /modelo 576|\b576\b|impuesto.*matriculacion/,
  roi: /\broi\b|retorno sobre la inversion/,
});

test("todas las asociaciones estructurales apuntan a entidades existentes", (context) => {
  if (!privateReady) return context.skip("La fuente editorial privada no forma parte del checkout público");
  const lessons = new Map(program.lessons.map((lesson) => [lesson.id, lesson]));
  const concepts = new Map(sourceConcepts.map((concept) => [concept.id, concept]));
  const sources = new Set(program.officialSources.map((source) => source.id));
  sourceConcepts.forEach((concept) => {
    assert.ok(lessons.has(concept.lessonId), `${concept.id}: lessonId inexistente`);
    assert.equal(concept.anchor, concept.id, `${concept.id}: ancla inestable`);
    concept.relatedConceptIds.forEach((relatedId) => {
      assert.ok(concepts.has(relatedId), `${concept.id}: relatedConceptId inexistente ${relatedId}`);
      assert.equal(concepts.get(relatedId).lessonId, concept.lessonId, `${concept.id}: relación fuera de su lección`);
    });
    concept.officialSourceIds.forEach((sourceId) => assert.ok(sources.has(sourceId), `${concept.id}: fuente inexistente ${sourceId}`));
    assert.ok(concept.sourcePages.every((page) => Number.isInteger(page) && page >= 1 && page <= 150), `${concept.id}: página fuera de rango`);
  });
});

test("cada vínculo de glosario tiene una señal semántica visible", (context) => {
  if (!privateReady) return context.skip("La fuente editorial privada no forma parte del checkout público");
  const glossaryIds = new Set(program.glossary.map((entry) => entry.id));
  sourceConcepts.forEach((concept) => {
    const haystack = normalize([concept.title, concept.shortAnswer, concept.explanation, ...(concept.aliases || [])].join(" "));
    concept.glossaryTerms.forEach((termId) => {
      assert.ok(glossaryIds.has(termId), `${concept.id}: término inexistente ${termId}`);
      assert.match(haystack, GLOSSARY_SIGNALS[termId], `${concept.id}: asociación de glosario no respaldada (${termId})`);
    });
  });
});

test("las FAQ conservan lección y páginas trazables", (context) => {
  if (!privateReady) return context.skip("La fuente editorial privada no forma parte del checkout público");
  const lessonIds = new Set(program.lessons.map((lesson) => lesson.id));
  program.faqs.forEach((faq) => {
    if (faq.lessonId) assert.ok(lessonIds.has(faq.lessonId), `${faq.id}: lección FAQ inexistente`);
    assert.ok((faq.sourcePages || []).every((page) => Number.isInteger(page) && page >= 1 && page <= 150), `${faq.id}: página FAQ fuera de rango`);
  });
});
