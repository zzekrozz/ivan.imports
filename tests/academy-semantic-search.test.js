import assert from "node:assert/strict";
import test from "node:test";
import { answerSemanticQuery, normalizeSemanticText, rankSemanticItems } from "../assets/academy/private/semantic-search.js";

const items = [
  { type: "Conceptos", title: "Campo V.7", summary: "Indica las emisiones de CO₂ del vehículo.", href: "/paso/v7", keywords: ["CO2", "emisiones"], conceptId: "v7" },
  { type: "Conceptos", title: "Campo K", summary: "Identifica la homologación europea o nacional.", href: "/paso/k", keywords: ["homologación", "tipo"], conceptId: "k" },
  { type: "Respuestas", title: "¿Qué ocurre si falta el CoC?", summary: "Comprueba la documentación y si hace falta una ficha reducida.", href: "/respuestas#coc", keywords: ["certificado de conformidad"] },
  { type: "Conceptos", title: "Motorschaden", summary: "Avería o daño de motor; exige verificación.", href: "/paso/motor", keywords: ["motor", "avería"] },
  { type: "Conceptos", title: "Getriebeschaden", summary: "Daño o avería de la caja de cambios.", href: "/paso/cambio", keywords: ["transmisión"] },
  { type: "Herramientas", title: "Calculadora de coste total", summary: "Compara coste, margen y ROI.", href: "/herramientas/coste-total", keywords: ["rentabilidad"] },
  { type: "Conceptos", title: "Placas de exportación", summary: "Permiten circular durante la vuelta cuando corresponda.", href: "/paso/placas", keywords: ["matrícula exportación"] },
];

test("normaliza V.7, CO₂ y frases del dominio", () => {
  assert.equal(normalizeSemanticText("¿Dónde miro el CO₂ en V.7?"), "donde miro el co2 en v7");
});

test("entiende equivalencias semánticas sin exigir coincidencia literal", () => {
  assert.equal(rankSemanticItems("emisiones carbono", items)[0].item.conceptId, "v7");
  assert.equal(rankSemanticItems("avería en la caja de cambios", items)[0].item.title, "Getriebeschaden");
  assert.equal(rankSemanticItems("certificado conformidad", items)[0].item.type, "Respuestas");
});

test("tolera una errata leve y conserva orden determinista", () => {
  const first = rankSemanticItems("motorschaden", items).map(({ item }) => item.href);
  const second = rankSemanticItems("motorschaden", items).map(({ item }) => item.href);
  assert.deepEqual(first, second);
  assert.equal(rankSemanticItems("motorschden", items)[0].item.title, "Motorschaden");
});

test("devuelve respuesta trazable solo con confianza suficiente", () => {
  const found = answerSemanticQuery("qué indica el v7", items);
  assert.equal(found.answer?.conceptId, "v7");
  assert.equal(found.answer?.confidence, "alta");
  assert.equal(answerSemanticQuery("ornitorrinco violeta", items).answer, null);
});

test("relaciona placas, ROI y campo K con sus contenidos", () => {
  assert.match(rankSemanticItems("matrícula para exportar", items)[0].item.title, /Placas/);
  assert.match(rankSemanticItems("beneficio rentabilidad", items)[0].item.title, /coste total/i);
  assert.equal(rankSemanticItems("tipo homologación", items)[0].item.conceptId, "k");
});
