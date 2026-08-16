import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../assets/academy/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/academy/app.css", import.meta.url), "utf8");

test("UI incluye loading, error, ficha, manual, biblioteca y analytics sin datos sensibles", () => {
  for (const text of ["Leyendo anuncio…", "Crear ficha manualmente", "Mis vehículos", "Actualizar desde mobile.de", "Calcular operación", "No indicado", "vehicle_import_started", "vehicle_import_success", "vehicle_import_failed", "vehicle_manual_created"]) assert.match(app, new RegExp(text));
  assert.doesNotMatch(app, /academyTrack\([^\n]*(?:VIN|phone|sourceUrl|description)/);
});

test("UI tiene reglas responsive específicas", () => {
  assert.match(css, /\.vehicle-card-grid/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /\.vehicle-detail-actions \.academy-button \{ width:100%/);
  assert.match(app, /input:not\(\[type="hidden"\]\)/);
});
