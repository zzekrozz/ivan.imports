const entries = [
  ["operation-dashboard", "operation-dashboard", "Mis vehículos", "/mis-vehiculos/", "Mis vehículos", false, 0, "Centro operativo de vehículos guardados y su estado actual."],
  ["candidate-board", "candidate-board", "Candidatos", "/mis-vehiculos/candidatos/", "Mis vehículos", false, 1, "Organiza vehículos candidatos sin duplicar su ficha."],
  ["budget-calculator", "presupuesto", "Presupuesto inicial", "/herramientas/presupuesto-inicial/", "Costes y rentabilidad", false, 20, "Separa coche, viaje, exportación, España e imprevistos."],
  ["search-filter-builder", "filtros", "Filtros y búsquedas", "/herramientas/filtros-busqueda/", "Vehículos y anuncios", false, 30, "Guarda criterios comparables y rutinas de búsqueda."],
  ["ad-analyzer", "analizador-anuncio", "Analizador de anuncios", "/herramientas/analizador-anuncios/", "Vehículos y anuncios", true, 10, "Crea una ficha editable desde un anuncio de mobile.de."],
  ["question-builder", "preguntas", "Preparador de preguntas", "/herramientas/preparador-preguntas/", "Vehículos y anuncios", false, 40, "Ordena llamada y bloques breves para WhatsApp."],
  ["market-comparator", "mercado", "Comparador con España", "/herramientas/comparador-espana/", "Mercado", true, 12, "Construye una muestra equivalente y una franja conservadora."],
  ["cost-calculator", "coste-total", "Calculadora de coste de importación", "/herramientas/calculadora-coste-importacion/", "Costes y rentabilidad", true, 5, "Suma todos los gastos y calcula el coste real, el margen y la compra máxima."],
  ["document-passport", "documentos", "Pasaporte documental", "/herramientas/pasaporte-documental/", "Documentación y matriculación", false, 50, "Muestra el estado de cada documento y la duda pendiente."],
  ["plan-abc", "plan-abc", "Plan A/B/C", "/herramientas/plan-abc/", "Vehículos y anuncios", false, 45, "Conserva alternativas cercanas y comprobables."],
  ["travel-planner", "viaje", "Planificador de viaje", "/herramientas/planificador-viaje/", "Viaje e inspección", false, 60, "Cruza vuelo, horarios, banco, placas y alternativas."],
  ["inspection-checklist", "inspeccion", "Inspección presencial", "/herramientas/inspeccion-presencial/", "Viaje e inspección", true, 15, "Guía la revisión antes y después de conducir."],
  ["paint-sheet", "pintura", "Hoja de pintura", "/herramientas/mediciones-pintura/", "Viaje e inspección", false, 70, "Ordena mediciones por panel sin usar una cifra universal."],
  ["purchase-exit-checklist", "compra-salida", "Compra y salida", "/herramientas/compra-salida/", "Viaje e inspección", false, 80, "Cierra VIN, pago, documentos, placas y seguro."],
  ["return-checklist", "vuelta", "Checklist de vuelta", "/herramientas/checklist-vuelta/", "Viaje e inspección", false, 90, "Mantiene niveles, descansos, costes y documentos a mano."],
  ["spain-folder", "espana", "Carpeta España", "/herramientas/carpeta-espana/", "Documentación y matriculación", false, 100, "Ordena ITV, fiscalidad, DGT, placas y seguro."],
  ["method7-planner", "metodo-7-dias", "Método 7 días", "/herramientas/metodo-7-dias/", "Planificación", false, 110, "Anticipa bloqueos y mueve tareas en paralelo sin garantizar plazo."],
];

const seo = {
  "cost-calculator": ["Calculadora de coste para importar un coche a España | IvanImports", "Calculadora de coste de importación de coches"],
  "ad-analyzer": ["Analizador de anuncios de coches de Alemania | IvanImports", "Analiza un anuncio de coche antes de comprarlo"],
};

export const TOOL_CATALOG = Object.freeze(entries.map(([id, slug, title, publicPath, category, featured, order, description]) => Object.freeze({
  id, slug, title, publicPath, publicSlug: publicPath.split("/").filter(Boolean).at(-1), category, featured, order, description,
  seoTitle: seo[id]?.[0] || `${title} | Herramientas IvanImports`,
  h1: seo[id]?.[1] || title,
  seoDescription: description,
  standalone: true,
})));

export function toolCatalogEntry(value) {
  const key = String(value || "");
  return TOOL_CATALOG.find((tool) => [tool.id, tool.slug, tool.publicSlug].includes(key)) || null;
}

export function validateToolCatalog(programTools = []) {
  const sourceIds = new Set(programTools.map((tool) => String(tool.id)));
  const catalogIds = new Set(TOOL_CATALOG.map((tool) => tool.id));
  if (sourceIds.size !== 17 || catalogIds.size !== 17 || [...sourceIds].some((id) => !catalogIds.has(id))) {
    throw new Error("El catálogo público no coincide con las 17 herramientas editoriales");
  }
  return true;
}
