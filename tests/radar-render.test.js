import test from "node:test";
import assert from "node:assert/strict";
import { renderFicha, row, esc } from "../assets/radar/render.js";
import { adminShell } from "../api/_radar/shell.js";

const evil = '<img src=x onerror=alert(1)>"\'';
const base = { id: "a", slug: "a-1", brand: evil, model: evil, versionName: evil, country: evil, platform: evil, price: 1000, year: 2020, km: 1, images: [{ url: "https://abc.public.blob.vercel-storage.com/x.jpg", alt: evil }], editorialStatus: "reviewed", listingStatus: "available", tier: "open", firstImpression: evil, description: evil, features: [evil], originalUrl: "javascript:alert(1)",
  analysis: { head: evil, why: evil, like: [evil], doubt: [evil], chk: evil, body: evil }, questions: [{ q: evil, status: "pending", answer: evil }], risks: [{ kind: "pending", text: evil }], comparables: [{ title: evil, price: 5, url: "javascript:alert(1)", note: evil }],
  costs: { mode: "truck", items: [{ key: "custom:abc", label: evil, group: 4, amount: 1, status: "estimated" }] }, costSummary: { total: 1001, subtotals: {}, pending: [evil], partial: true, reference: 2000, difference: 999 }, spainReference: { value: 2000, note: evil } };

test("el contenido editable se escapa siempre al pintar la lista y la ficha", () => {
  for (const html of [row(base), renderFicha(base)]) {
    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html.replace(/"[^"]*"/g, '""'), /<[a-z]+[^>]*\sonerror=/i, "ningún atributo de evento real");
  }
  assert.equal(esc(evil).includes("<"), false);
});

test("una ficha Gratis básica no pinta secciones PRO ni reproductores vacíos", () => {
  const html = renderFicha({ ...base, tier: "basic", analysis: undefined, costs: undefined, costSummary: undefined, questions: undefined, risks: undefined, comparables: undefined });
  assert.doesNotMatch(html, /El análisis de Iván|Calculadora|Preguntas pendientes|<video/);
  assert.match(html, /Radar PRO/);
});

test("el panel solo carga scripts propios y el de Google en el login", () => {
  const panel = adminShell({ state: "panel", csrf: "tok" });
  assert.match(panel, /src="\/assets\/radar\/admin\.js"/);
  assert.doesNotMatch(panel, /accounts\.google\.com/);
  assert.match(adminShell({ state: "login", clientId: "c.apps.googleusercontent.com" }), /accounts\.google\.com\/gsi\/client/);
  assert.doesNotMatch(adminShell({ state: "login", clientId: "x" }), /data-csrf="[^"]+"/);
});
