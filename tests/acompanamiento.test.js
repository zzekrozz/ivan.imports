import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHandler, validateAccompanimentSession } from "../api/acompanamiento.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const priceId = "price_accompaniment_unit_test";
const sessionId = `cs_test_${"A".repeat(24)}`;

function paidSession(overrides = {}) {
  return {
    id: sessionId,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency: "eur",
    amount_total: 99700,
    line_items: {
      data: [{ quantity: 1, amount_total: 99700, price: { id: priceId } }],
    },
    ...overrides,
  };
}

function env(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: "stripe-server-key-placeholder",
    STRIPE_ACOMPANAMIENTO_PRICE_ID: priceId,
    VERCEL_ENV: "preview",
    ...overrides,
  };
}

function statusRequest(body, { origin } = {}) {
  return new Request("https://ivanimports.es/api/acompanamiento?action=status", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}

function stripeMock(session, { status = 200, inspect } = {}) {
  return async (url, options = {}) => {
    inspect?.(url, options);
    return Response.json(session, { status });
  };
}

test("la sesión válida exige producto, importe, moneda, cantidad y una sola línea", () => {
  assert.deepEqual(validateAccompanimentSession(paidSession(), { priceId }), { valid: true, errors: [] });
  const invalid = paidSession({
    mode: "subscription",
    currency: "usd",
    amount_total: 1,
    line_items: { data: [{ quantity: 2, amount_total: 1, price: { id: "price_wrong" } }, { quantity: 1, amount_total: 1, price: { id: priceId } }] },
  });
  assert.deepEqual(validateAccompanimentSession(invalid, { priceId }).errors, ["mode", "currency", "amount_total", "line_items", "price_id", "quantity", "line_item_amount"]);
});

test("una Checkout Session completada y pagada devuelve confirmed sin exponer datos", async () => {
  let authorization = "";
  const handler = createHandler({
    env: env(),
    fetchImpl: stripeMock(paidSession(), {
      inspect: (url, options) => {
        assert.match(String(url), new RegExp(`/checkout/sessions/${sessionId}`));
        assert.match(String(url), /expand%5B%5D=line_items\.data\.price/);
        authorization = options.headers.Authorization;
      },
    }),
  });
  const response = await handler(statusRequest({ session_id: sessionId }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "confirmed" });
  assert.equal(authorization, "Bearer stripe-server-key-placeholder");
  assert.equal(JSON.stringify(body).includes(sessionId), false);
  assert.equal(JSON.stringify(body).includes("stripe-server-key-placeholder"), false);
});

test("una sesión del producto todavía no pagada o no completada permanece pending", async (t) => {
  for (const session of [paidSession({ payment_status: "unpaid" }), paidSession({ status: "open" })]) {
    await t.test(`${session.payment_status}/${session.status}`, async () => {
      const handler = createHandler({ env: env(), fetchImpl: stripeMock(session) });
      const response = await handler(statusRequest({ session_id: sessionId }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "pending" });
    });
  }
});

test("un Price ID o importe distinto nunca confirma la compra", async () => {
  const wrongProduct = paidSession({ amount_total: 99600, line_items: { data: [{ quantity: 1, amount_total: 99600, price: { id: "price_other" } }] } });
  const handler = createHandler({ env: env(), fetchImpl: stripeMock(wrongProduct) });
  const response = await handler(statusRequest({ session_id: sessionId }));
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { status: "unverified" });
});

test("sesión ausente, método incorrecto y origen ajeno no consultan Stripe", async () => {
  let calls = 0;
  const handler = createHandler({ env: env({ VERCEL_ENV: "production" }), fetchImpl: async () => { calls += 1; return Response.json(paidSession()); } });
  const missing = await handler(statusRequest({ session_id: "" }));
  assert.equal(missing.status, 400);
  const wrongOrigin = await handler(statusRequest({ session_id: sessionId }, { origin: "https://example.com" }));
  assert.equal(wrongOrigin.status, 403);
  const get = await handler(new Request("https://ivanimports.es/api/acompanamiento?action=status"));
  assert.equal(get.status, 405);
  assert.equal(calls, 0);
});

test("una sesión inexistente o una configuración incompleta fallan de forma neutra", async (t) => {
  await t.test("resource_missing", async () => {
    const handler = createHandler({ env: env(), fetchImpl: stripeMock({ error: { code: "resource_missing" } }, { status: 404 }) });
    const response = await handler(statusRequest({ session_id: sessionId }));
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { status: "unverified" });
  });
  await t.test("Price ID ausente", async () => {
    const handler = createHandler({ env: env({ STRIPE_ACOMPANAMIENTO_PRICE_ID: "" }), fetchImpl: stripeMock(paidSession()) });
    const response = await handler(statusRequest({ session_id: sessionId }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unverified" });
  });
});

test("la página empieza verificando, borra la query pronto y solo confirma tras la API", () => {
  const html = read("gracias-acompanamiento/index.html");
  const client = read("assets/accompaniment-thanks.js");
  const siteConfig = read("assets/site-config.js");
  assert.match(html, /data-payment-status="checking"/);
  assert.match(html, /<h1[^>]*data-payment-title>Estamos verificando tu pago<\/h1>/);
  assert.doesNotMatch(html, /¡Pago recibido!/);
  assert.ok(html.indexOf("replaceState") < html.indexOf("/assets/site.css"));
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(client, /fetch\("\/api\/acompanamiento\/status"/);
  assert.match(client, /result\.status === "confirmed"/);
  assert.match(client, /¡Pago recibido! 🎉/);
  assert.match(client, /Estamos confirmando tu pago/);
  assert.match(client, /No hemos podido verificar el pago desde este enlace\./);
  assert.match(siteConfig, /whatsappPhone: "34674252436"/);
  assert.doesNotMatch(html + client, /\bsk_(?:live|test)_|STRIPE_SECRET_KEY/);
});

test("Klarna aparece junto a 997 € sin publicar un Payment Link", () => {
  const services = read("assets/data/services.json");
  const generator = read("scripts/build-public-pages.mjs");
  assert.match(services, /También puedes pagar en 3 plazos con Klarna\. Sujeto a aprobación\./);
  assert.match(generator, /hub-payment-note--hero/);
  assert.doesNotMatch(services + generator, /buy\.stripe\.com|financiación garantizada|aprobación garantizada/i);
});

test("Vercel conserva pagos históricos y añade el endpoint aislado", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const rewrites = new Map(vercel.rewrites.map((entry) => [entry.source, entry.destination]));
  assert.equal(rewrites.get("/api/acompanamiento/status"), "/api/acompanamiento?action=status");
  assert.equal(rewrites.get("/api/importa-7-dias/order-status"), "/api/importa-7-dias?action=order-status");
  assert.ok(vercel.functions["api/acompanamiento.js"]);
  assert.ok(vercel.functions["api/importa-7-dias.js"]);
});
