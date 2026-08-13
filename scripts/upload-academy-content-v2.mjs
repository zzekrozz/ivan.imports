import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { academyBlobAccessFromEnv, academyBlobSdkOptions, academyPrivateBlobOptions } from "../api/_academy/blob.js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmed = args.has("--confirm-private-upload");
const confirmProduction = args.has("--confirm-production");
const localPath = resolve(process.env.ACADEMY_CONTENT_V2_LOCAL_PATH || "private-products/academy/v2/dist/program-v2.json");
const blobPathname = String(process.env.ACADEMY_CONTENT_BLOB_PATHNAME || "").trim();
const blobAccess = academyBlobAccessFromEnv(process.env, { required: apply });
const maximumBytes = 4 * 1024 * 1024;

if (process.argv.some((argument) => /^--(?:token|blob-token)=/i.test(argument))) {
  throw new Error("Nunca pases credenciales Blob como argumento; usa las variables Academy del entorno");
}

const bytes = await readFile(localPath);
const info = await stat(localPath);
if (info.size > maximumBytes) throw new Error("El contenido v2 supera el límite privado de 4 MiB");

let program;
try {
  program = JSON.parse(bytes.toString("utf8"));
} catch {
  throw new Error("El archivo privado v2 no contiene JSON válido");
}

if (program.id !== "importa-tu-primer-coche") throw new Error("Program ID inesperado; el entitlement ID debe permanecer estable");
if (program.schemaVersion !== 2) throw new Error("Se esperaba schemaVersion 2");
if (!Array.isArray(program.stages) || program.stages.length !== 13) throw new Error("Se esperaban 13 etapas");
if (!Array.isArray(program.lessons) || program.lessons.length !== 72) throw new Error("Se esperaban 72 lecciones");
if (!Array.isArray(program.concepts) || program.concepts.length !== 317) throw new Error("Se esperaban 317 conceptos");
if (!Array.isArray(program.tools) || program.tools.length !== 17) throw new Error("Se esperaban 17 herramientas");
if (!Array.isArray(program.videos) || program.videos.length !== 40 || program.videos.some((video) => video.status !== "planned" || video.url)) {
  throw new Error("El plan debe contener 40 vídeos planned sin URL inventada");
}
if (!program.legacyLessonMap || program.legacyLessonMap.schemaVersion !== 2 || program.legacyLessonMap.mappings?.length !== 317) {
  throw new Error("Falta el mapa privado de 317 pasos legacy");
}

const stageIds = new Set(program.stages.map((stage) => stage.id));
const lessonIds = new Set(program.lessons.map((lesson) => lesson.id));
const conceptIds = new Set(program.concepts.map((concept) => concept.id));
const toolIds = new Set(program.tools.map((tool) => tool.id));
if (stageIds.size !== 13 || lessonIds.size !== 72 || conceptIds.size !== 317 || toolIds.size !== 17) throw new Error("Hay IDs duplicados en el programa v2");

for (const lesson of program.lessons) {
  if (!stageIds.has(lesson.stageId)) throw new Error(`Etapa inexistente en ${lesson.id}`);
  if (!new Set(["authored", "reviewed"]).has(lesson.editorialStatus)) throw new Error(`Editorial status bloqueado en ${lesson.id}`);
  if (!Array.isArray(lesson.sourcePages) || !lesson.sourcePages.length) throw new Error(`Lección sin páginas fuente: ${lesson.id}`);
  if (!lesson.simpleExplanation || !lesson.actionNow?.body) throw new Error(`Lección incompleta: ${lesson.id}`);
  if (!Array.isArray(lesson.conceptIds) || lesson.conceptIds.some((id) => !conceptIds.has(id))) throw new Error(`Concepto inexistente en ${lesson.id}`);
}
for (const concept of program.concepts) {
  if (!lessonIds.has(concept.lessonId) || !concept.anchor || !concept.explanation || !concept.action) throw new Error(`Concepto incompleto: ${concept.id}`);
}
for (const mapping of program.legacyLessonMap.mappings) {
  if (!lessonIds.has(mapping.lessonId) || !conceptIds.has(mapping.conceptId) || !mapping.anchor) throw new Error(`Mapping legacy incompleto: ${mapping.legacyLessonId}`);
}

console.log(JSON.stringify({
  mode: apply ? "apply-requested" : "dry-run",
  environment: blobAccess.blobEnvironment || "not-selected",
  storeConfigured: Boolean(blobAccess.blobStoreId),
  authentication: blobAccess.blobAuthMode || "not-required-for-dry-run",
  pathname: blobPathname || "not-configured",
  file: localPath,
  bytes: info.size,
  id: program.id,
  version: program.version,
  schemaVersion: program.schemaVersion,
  stages: program.stages.length,
  lessons: program.lessons.length,
  concepts: program.concepts.length,
  mappings: program.legacyLessonMap.mappings.length,
  tools: program.tools.length,
  videos: program.videos.length,
}, null, 2));

if (!apply) {
  console.log("Validación v2 correcta. No se ha abierto ninguna conexión ni modificado Blob.");
  process.exit(0);
}

if (!confirmed) throw new Error("Para subir, añade --apply --confirm-private-upload");
if (!blobPathname) throw new Error("Falta ACADEMY_CONTENT_BLOB_PATHNAME");
const blobOptions = academyPrivateBlobOptions(blobAccess, blobPathname);
if (blobAccess.blobEnvironment === "production" && !confirmProduction) {
  throw new Error("Producción requiere además --confirm-production");
}

const { put } = await import("@vercel/blob");
await put(blobOptions.pathname, bytes, {
  ...academyBlobSdkOptions(blobOptions),
  contentType: "application/json; charset=utf-8",
  addRandomSuffix: false,
  allowOverwrite: true,
});

console.log(JSON.stringify({ uploaded: true, access: "private", environment: blobAccess.blobEnvironment, pathname: blobOptions.pathname, bytes: info.size }, null, 2));
