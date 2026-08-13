import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validatePublicAcademyCatalog } from "./validate-academy-public.mjs";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const seoStandaloneConceptIds = new Set([
  "concept-3-03-motorschaden", "concept-3-04-getriebeschaden", "concept-3-06-bastlerfahrzeug-y-nur-export", "concept-6-12-coc-frente-a-campo-k", "concept-6-19-k-vacio", "concept-6-18-campo-v-7", "concept-6-08-tuv-hu-y-vigencia", "concept-11-04-coc-o-ficha-reducida", "concept-5-17-modelo-576-como-partida-propia", "concept-11-17-ivtm", "concept-11-19-tasa-1-1", "concept-5-11-placas-de-exportacion", "concept-11-10-itv-de-matriculacion", "concept-6-41-herramienta-plan-a-b-c", "concept-8-08-medidor-de-pintura", "concept-8-04-lector-obd", "concept-4-18-formula-de-precio-maximo-europeo", "concept-5-05-roi-explicado-de-forma-sencilla"
]);

function compilePublicCatalog(source) {
if (source.schemaVersion !== 2) throw new Error("La publicación requiere schemaVersion 2");
if (source.stages?.length !== 13 || source.lessons?.length !== 72 || source.concepts?.length !== 317 || source.tools?.length !== 17) {
  throw new Error("El catálogo fuente no conserva 13 etapas, 72 lecciones, 317 conceptos y 17 herramientas");
}
const publicResources = source.resources.map((resource) => {
  const next = {
    ...resource,
    status: "public-free",
    privateDelivery: undefined,
  };
  if (resource.id === "guide") {
    next.title = "IvanImports Academy · Edición PDF";
    next.description = "Edición descargable e imprimible. Todo el contenido educativo permanece gratis en la web.";
    next.publicUrl = "/academia/edicion-pdf/";
    next.status = "product-disabled";
    next.available = false;
    next.size = "";
  }
  if (resource.id === "workbook") {
    next.title = "Cuaderno de trabajo";
    next.description = "Incluido en la futura edición PDF; no se distribuye mediante una URL pública.";
    next.publicUrl = "/academia/edicion-pdf/";
    next.status = "product-disabled";
    next.available = false;
    next.size = "";
  }
  return next;
});

publicResources.push({
  id: "guide-placas-verdes",
  title: "Guía de placas verdes",
  description: "Permiso temporal, requisitos, vigencia, costes y pasos ante la DGT.",
  type: "guide",
  version: "2026.08",
  available: true,
  status: "public-free",
  publicUrl: "/placasverdes/",
  keywords: ["placas verdes", "DGT", "permiso temporal", "matriculación"],
});

return {
  ...source,
  access: "public-free",
  platformVersion: "1.0.0",
  publicPath: "/academia/",
  editorialPolicy: {
    ...source.editorialPolicy,
    noPublicCatalogBodies: false,
  },
  concepts: source.concepts.map((concept) => ({ ...concept, seoStandalone: seoStandaloneConceptIds.has(concept.id) })),
  resources: publicResources,
  publicRelease: {
    releasedAt: "2026-08-13",
    registrationRequired: false,
    paymentRequired: false,
    stateStorage: "local-device",
  },
};
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function publishAcademyPublic({ root = defaultRoot } = {}) {
  const sourcePath = resolve(root, "private-products/academy/v2/dist/program-v2.json");
  const outputPath = resolve(root, "assets/academy/program-v2.json");

  if (existsSync(sourcePath)) {
    console.log("Academy: regenerating public catalog from editorial source.");
    const published = validatePublicAcademyCatalog(compilePublicCatalog(await readJson(sourcePath)));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(published)}\n`, "utf8");
    console.log(`Academia pública generada: ${published.stages.length} etapas, ${published.lessons.length} lecciones, ${published.concepts.length} conceptos, ${published.tools.length} herramientas.`);
    return { mode: "regenerated", outputPath, program: published };
  }

  if (existsSync(outputPath)) {
    console.log("Academy: editorial source unavailable in this checkout; validated versioned public catalog will be reused.");
    const program = validatePublicAcademyCatalog(await readJson(outputPath));
    console.log(`Academia pública validada: ${program.stages.length} etapas, ${program.lessons.length} lecciones, ${program.concepts.length} conceptos, ${program.tools.length} herramientas.`);
    return { mode: "reused", outputPath, program };
  }

  throw new Error("Academy build cannot continue: neither editorial source nor versioned public catalog is available.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await publishAcademyPublic();
}
