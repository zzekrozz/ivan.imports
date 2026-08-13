import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { academyBlobAccessFromEnv, academyBlobSdkOptions, academyPrivateBlobOptions } from "../api/_academy/blob.js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmed = args.has("--confirm-private-upload");
const confirmProduction = args.has("--confirm-production");
const localPath = resolve(process.env.ACADEMY_CONTENT_LOCAL_PATH || "private-products/academy/program-2026.json");
const blobPathname = String(process.env.ACADEMY_CONTENT_BLOB_PATHNAME || "").trim();
const blobAccess = academyBlobAccessFromEnv(process.env, { required: apply });

if (process.argv.some((arg) => /^--(?:token|blob-token)=/i.test(arg))) {
  throw new Error("Nunca pases credenciales Blob como argumento; usa las variables Academy del entorno");
}

const bytes = await readFile(localPath);
const info = await stat(localPath);
if (info.size > 4 * 1024 * 1024) throw new Error("El contenido supera el límite privado de 4 MiB");

let program;
try {
  program = JSON.parse(bytes.toString("utf8"));
} catch {
  throw new Error("El archivo privado no contiene JSON válido");
}

if (program.id !== "importa-tu-primer-coche") throw new Error("Program ID inesperado");
if (!Array.isArray(program.stages) || program.stages.length !== 13) throw new Error("Se esperaban 13 etapas");
if (!Array.isArray(program.lessons) || program.lessons.length !== 317) throw new Error("Se esperaban 317 pasos");
if (!Array.isArray(program.tools) || program.tools.length < 10) throw new Error("Falta el catálogo de herramientas");
if (!Array.isArray(program.videos) || program.videos.length !== 40 || program.videos.some((video) => video.status !== "planned" || video.url)) {
  throw new Error("El plan debe contener 40 vídeos planned sin URL inventada");
}

const lessonIds = new Set(program.lessons.map((lesson) => lesson.id));
if (lessonIds.size !== program.lessons.length) throw new Error("Hay lesson IDs duplicados");
if (program.stages.some((stage) => !Array.isArray(stage.lessonIds) || stage.lessonIds.some((id) => !lessonIds.has(id)))) {
  throw new Error("Una etapa referencia un paso inexistente");
}
const officialSourceIds = new Set((program.officialSources || []).map((source) => source.id));
for (const lesson of program.lessons) {
  if (!Array.isArray(lesson.blocks) || !lesson.blocks.length) throw new Error(`Paso sin bloques: ${lesson.id}`);
  for (const block of lesson.blocks) {
    if (block.type === "oficial" && !officialSourceIds.has(block.sourceId)) throw new Error(`Bloque oficial sin fuente oficial: ${lesson.id}`);
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply-requested" : "dry-run",
  file: localPath,
  bytes: info.size,
  version: program.version,
  stages: program.stages.length,
  lessons: program.lessons.length,
  tools: program.tools.length,
  videos: program.videos.length,
}, null, 2));

if (!apply) {
  console.log("Validación correcta. No se ha abierto ninguna conexión ni modificado Blob.");
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
