import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ACADEMY_PROGRAM_ID } from "./security.js";
import { academyBlobSdkOptions, academyPrivateBlobOptions } from "./blob.js";

const MAX_PROGRAM_BYTES = 4 * 1024 * 1024;
const LOCAL_PROGRAM_PATHS = Object.freeze([
  fileURLToPath(new URL("../../private-products/academy/v2/dist/program-v2.json", import.meta.url)),
  fileURLToPath(new URL("../../private-products/academy/program-2026.json", import.meta.url)),
]);

export const ACADEMY_PROGRAM = Object.freeze({
  id: ACADEMY_PROGRAM_ID,
  title: "Importa tu primer coche",
  descriptor: "Programa privado paso a paso de Academia IvanImports.",
  edition: "2026",
  stages: Object.freeze([]),
  lessons: Object.freeze([]),
  tools: Object.freeze([]),
  answers: Object.freeze([]),
  faqs: Object.freeze([]),
  resources: Object.freeze([
    Object.freeze({ id: "guide", title: "Guía principal", type: "pdf", endpoint: "/api/academy/resource?file=guide" }),
    Object.freeze({ id: "workbook", title: "Cuaderno de trabajo", type: "pdf", endpoint: "/api/academy/resource?file=workbook" }),
  ]),
  glossary: Object.freeze([]),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function publicProgram() {
  return clone(ACADEMY_PROGRAM);
}

const DEMO_STAGE_TITLES = Object.freeze([
  "Empieza aquí",
  "Presupuesto",
  "Mercado y candidatos",
  "Vendedor y anuncio",
  "Documentación",
  "Historial y estado",
  "Coste total",
  "Negociación",
  "Viaje e inspección",
  "Compra y pago",
  "Regreso o transporte",
  "Trámites en España",
  "Cierre de operación",
]);

export function demoProgram() {
  const stages = DEMO_STAGE_TITLES.map((title, index) => ({
    id: `demo-stage-${String(index).padStart(2, "0")}`,
    slug: index === 0 ? "demo-empieza-aqui" : `demo-etapa-${index}`,
    order: index,
    kind: index === 0 ? "prologue" : "core",
    countsTowardProgress: index !== 0,
    title,
    description: "Vista estructural del recorrido. El contenido operativo completo requiere un acceso de alumno.",
    lessonIds: [`demo-lesson-${String(index).padStart(2, "0")}`],
  }));
  const lessons = DEMO_STAGE_TITLES.map((title, index) => ({
    id: `demo-lesson-${String(index).padStart(2, "0")}`,
    slug: `demo-paso-${String(index).padStart(2, "0")}`,
    stageId: `demo-stage-${String(index).padStart(2, "0")}`,
    order: 1,
    countsTowardProgress: index !== 0,
    title: `Vista previa: ${title}`,
    summary: "Ejemplo seguro de navegación sin revelar el material premium.",
    blocks: [{
      type: "body",
      title: "Modo presentación",
      body: "Esta muestra permite comprobar la experiencia, el progreso y la estructura. No contiene instrucciones, checklists ni fuentes del programa privado.",
    }],
  }));
  return {
    ...publicProgram(),
    descriptor: "Demostración segura y de solo lectura de Academia IvanImports.",
    stages,
    lessons,
    tools: [{ id: "demo-presupuesto", slug: "presupuesto", title: "Herramienta de presupuesto (muestra)", demo: true }],
  };
}

function validateProgram(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Academy program must be an object");
  if (value.id !== ACADEMY_PROGRAM_ID) throw new Error("Academy program ID mismatch");
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 200) throw new Error("Academy program title is invalid");
  for (const field of ["stages", "lessons", "tools", "resources", "glossary"]) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].length > 500)) throw new Error(`Academy program ${field} is invalid`);
  }
  if (value.answers !== undefined && !Array.isArray(value.answers)) throw new Error("Academy program answers is invalid");
  if (value.faqs !== undefined && !Array.isArray(value.faqs)) throw new Error("Academy program faqs is invalid");
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_PROGRAM_BYTES) throw new Error("Academy program exceeds the private payload limit");
  if (/"(?:__proto__|prototype|constructor)"\s*:/.test(serialized)) throw new Error("Academy program contains an unsafe key");
  return JSON.parse(serialized);
}

async function streamTextWithLimit(stream, maximum = MAX_PROGRAM_BYTES) {
  if (!stream?.getReader) throw new Error("Private academy content stream is unavailable");
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel("payload_too_large").catch(() => {});
      throw new Error("Private academy content exceeds the payload limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function privateProgram({ config = {}, blobGet, localRead = readFile } = {}) {
  if (config.contentBlobPathname) {
    if (typeof blobGet !== "function") throw new Error("Private academy Blob reader is unavailable");
    const options = academyPrivateBlobOptions(config, config.contentBlobPathname);
    const result = await blobGet(options.pathname, academyBlobSdkOptions(options));
    if (!result || result.statusCode !== 200) throw new Error("Private academy program was not found");
    return validateProgram(JSON.parse(await streamTextWithLimit(result.stream)));
  }

  if (config.vercelEnv === "development") {
    for (const localProgramPath of LOCAL_PROGRAM_PATHS) {
      try {
        const source = await localRead(localProgramPath, "utf8");
        if (Buffer.byteLength(source, "utf8") > MAX_PROGRAM_BYTES) throw new Error("Local academy program exceeds the payload limit");
        return validateProgram(JSON.parse(source));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    return publicProgram();
  }

  throw new Error("Private academy content is not configured");
}
