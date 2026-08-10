import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildCustomerEmail,
  buildDownloadToken,
  createHandler,
  isBonusEligible,
  maskEmail,
  supportExpiresAt,
  validateProductSession,
  verifyDownloadToken,
  verifyStripeSignature,
} from "../api/importa-7-dias.js";

const sessionId = "cs_test_1234567890abcdef";
const paymentLinkId = "plink_test_importa7";
const priceId = "price_test_importa7";
const signingSecret = "download-signing-secret-with-more-than-32-characters";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function paidSession(overrides = {}) {
  return {
    id: sessionId,
    mode: "payment",
    payment_link: paymentLinkId,
    payment_status: "paid",
    currency: "eur",
    amount_total: 17900,
    created: 1786312800,
    customer: "cus_importa7",
    customer_details: { email: "ana.ejemplo@example.com", name: "Ana Ejemplo" },
    payment_intent: { created: 1786312810, latest_charge: { created: 1786312820 } },
    line_items: { data: [{ quantity: 1, price: { id: priceId } }] },
    ...overrides,
  };
}

function config(overrides = {}) {
  return {
    paymentLinkId,
    priceId,
    expectedAmount: 17900,
    resendFrom: "IvanImports <entrega@example.com>",
    supportPhone: "34600000000",
    ...overrides,
  };
}

function env(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: "stripe-server-key-placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_unit_test",
    STRIPE_IMPORTA_7_DIAS_PAYMENT_LINK_ID: paymentLinkId,
    STRIPE_IMPORTA_7_DIAS_PRICE_ID: priceId,
    STRIPE_IMPORTA_7_DIAS_EXPECTED_AMOUNT: "17900",
    RESEND_API_KEY: "resend-server-key-placeholder",
    RESEND_FROM_EMAIL: "IvanImports <entrega@example.com>",
    RESEND_IMPORTA_7_DIAS_SEGMENT_ID: "segment_importa7",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token-placeholder",
    IMPORTA_7_DIAS_DOWNLOAD_SIGNING_SECRET: signingSecret,
    IMPORTA_7_DIAS_BASE_URL: "https://ivanimports.es",
    IMPORTA_7_DIAS_SUPPORT_PHONE_E164: "+34600000000",
    ...overrides,
  };
}

function stripeHeader(rawBody, secret, timestamp) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function createServiceMock({ session = paidSession(), failEmailTimes = 0, emailGate = null } = {}) {
  const redis = new Map();
  let emailCalls = 0;
  let contactCreates = 0;

  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith("https://api.stripe.com/v1/checkout/sessions/")) return json(session);

    if (target === "https://redis.example.test") {
      const command = JSON.parse(options.body);
      const operation = command[0];
      if (operation === "GET") return json({ result: redis.get(command[1]) ?? null });
      if (operation === "SET") {
        if (command.includes("NX") && redis.has(command[1])) return json({ result: null });
        redis.set(command[1], command[2]);
        return json({ result: "OK" });
      }
      if (operation === "EVAL") {
        const key = command[3];
        if (redis.get(key) === command[4]) redis.delete(key);
        return json({ result: 1 });
      }
      return json({ error: "unsupported" }, 400);
    }

    if (target === "https://api.resend.com/emails") {
      emailCalls += 1;
      if (emailGate) await emailGate(emailCalls);
      if (emailCalls <= failEmailTimes) return json({ message: "temporary outage" }, 503);
      return json({ id: `email_${emailCalls}` });
    }
    if (target.startsWith("https://api.resend.com/contacts/") && (!options.method || options.method === "GET")) return json({}, 404);
    if (target === "https://api.resend.com/contacts") {
      contactCreates += 1;
      return json({ id: "contact_importa7" });
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  return {
    fetchImpl,
    redis,
    stats: () => ({ emailCalls, contactCreates }),
  };
}

test("la firma Stripe válida se acepta y las firmas manipuladas o antiguas se rechazan", () => {
  const now = 1_786_312_820;
  const body = '{"id":"evt_test"}';
  const secret = "whsec_unit_test";
  assert.equal(verifyStripeSignature(body, stripeHeader(body, secret, now), secret, now), true);
  assert.throws(() => verifyStripeSignature(`${body}x`, stripeHeader(body, secret, now), secret, now), /Invalid Stripe signature/);
  assert.throws(() => verifyStripeSignature(body, stripeHeader(body, secret, now - 301), secret, now), /outside tolerance/);
});

test("la sesión debe coincidir en modo, Payment Link, Price ID, EUR, importe, cantidad y pago", () => {
  assert.deepEqual(validateProductSession(paidSession(), config()), { valid: true, errors: [] });
  const wrong = paidSession({ currency: "usd", amount_total: 100, payment_link: "plink_other", payment_status: "unpaid" });
  const result = validateProductSession(wrong, config());
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["payment_link", "currency", "amount_total", "payment_status"]);
  assert.equal(validateProductSession(paidSession({ line_items: { data: [{ quantity: 1, price: { id: "price_other" } }] } }), config()).valid, false);
});

test("el bonus incluye exactamente el deadline de Madrid y excluye el segundo posterior", () => {
  const deadline = Math.floor(Date.parse("2026-08-16T23:59:59+02:00") / 1000);
  assert.equal(isBonusEligible(deadline - 1), true);
  assert.equal(isBonusEligible(deadline), true);
  assert.equal(isBonusEligible(deadline + 1), false);
  assert.equal(supportExpiresAt(deadline) - deadline, 14 * 24 * 60 * 60);
});

test("el email se enmascara sin devolver la dirección completa", () => {
  assert.equal(maskEmail("ana.ejemplo@example.com"), "an******@example.com");
  assert.equal(maskEmail("x@example.com"), "tu correo de compra");
});

test("los tokens privados son firmados, caducan y no aceptan manipulación", () => {
  const token = buildDownloadToken({ sessionId, file: "guide", expiresAt: 2_000, secret: signingSecret });
  assert.equal(verifyDownloadToken(token, signingSecret, 1_999)?.sid, sessionId);
  assert.equal(verifyDownloadToken(token, signingSecret, 1_999)?.f, "guide");
  assert.equal(verifyDownloadToken(token, signingSecret, 2_000), null);
  assert.equal(verifyDownloadToken(`${token}x`, signingSecret, 1_999), null);
  assert.throws(() => buildDownloadToken({ sessionId, file: "other", expiresAt: 2_000, secret: signingSecret }), /Invalid download resource/);
});

test("el email incluye enlaces privados y solo muestra WhatsApp cuando hay bonus", () => {
  const beforeDeadline = Math.floor(Date.parse("2026-08-16T23:59:59+02:00") / 1000);
  const withBonus = buildCustomerEmail({
    session: paidSession(),
    paidAt: beforeDeadline,
    bonusEligible: true,
    supportEnd: supportExpiresAt(beforeDeadline),
    guideUrl: "https://ivanimports.es/api/importa-7-dias/download?file=guide&token=signed",
    workbookUrl: "https://ivanimports.es/api/importa-7-dias/download?file=workbook&token=signed",
    downloadExpiresAt: beforeDeadline + 604800,
    config: config(),
  });
  assert.match(withBonus.html, /ABRIR GUÍA PRINCIPAL/);
  assert.match(withBonus.html, /wa\.me\/34600000000/);
  assert.match(withBonus.text, /14 días de Acompañamiento/);
  assert.equal("reply_to" in withBonus, false);
  assert.doesNotMatch(withBonus.text, /responder directamente/i);
  assert.doesNotMatch(withBonus.html, /KRONOS 2022/i);

  const withoutBonus = buildCustomerEmail({
    session: paidSession(), paidAt: beforeDeadline + 1, bonusEligible: false, supportEnd: null,
    guideUrl: "https://example.test/guide", workbookUrl: "https://example.test/workbook", downloadExpiresAt: beforeDeadline + 604801,
    config: config(),
  });
  assert.doesNotMatch(withoutBonus.html, /BONUS DE LANZAMIENTO|wa\.me/);
  assert.doesNotMatch(withoutBonus.text, /BONUS DE LANZAMIENTO|wa\.me/);
});

test("order-status confirma en servidor, enmascara el email y no entrega URLs privadas", async () => {
  const service = createServiceMock();
  const handler = createHandler({ env: env(), fetchImpl: service.fetchImpl });
  const response = await handler(new Request("https://ivanimports.es/api/importa-7-dias?action=order-status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }),
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "confirmed");
  assert.equal(body.masked_email, "an******@example.com");
  assert.equal(JSON.stringify(body).includes("download"), false);
  assert.equal(JSON.stringify(body).includes("wa.me"), false);
});

test("order-status trata session_id inválido y pagos no confirmados sin entregar", async () => {
  let called = false;
  const invalidHandler = createHandler({ env: env(), fetchImpl: async () => { called = true; return json({}); } });
  const invalid = await invalidHandler(new Request("https://ivanimports.es/api/importa-7-dias?action=order-status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: "invalid" }),
  }));
  assert.equal(invalid.status, 400);
  assert.equal(called, false);

  const service = createServiceMock({ session: paidSession({ payment_status: "unpaid" }) });
  const pendingHandler = createHandler({ env: env(), fetchImpl: service.fetchImpl });
  const pending = await pendingHandler(new Request("https://ivanimports.es/api/importa-7-dias?action=order-status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }),
  }));
  assert.equal((await pending.json()).status, "pending");
});

test("el webhook entrega una vez y un reenvío idéntico no duplica email ni contacto", async () => {
  const service = createServiceMock();
  const handler = createHandler({ env: env(), fetchImpl: service.fetchImpl });
  const event = { id: "evt_importa7_1", type: "checkout.session.completed", created: paidSession().created, data: { object: { id: sessionId } } };
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const request = () => new Request("https://ivanimports.es/api/importa-7-dias?action=webhook", {
    method: "POST", headers: { "stripe-signature": stripeHeader(raw, env().STRIPE_WEBHOOK_SECRET, timestamp) }, body: raw,
  });

  const first = await handler(request());
  assert.equal(first.status, 200);
  assert.equal((await first.json()).delivered, true);
  const second = await handler(request());
  const secondBody = await second.json();
  assert.equal(second.status, 200);
  assert.equal(secondBody.duplicate, true);
  assert.deepEqual(service.stats(), { emailCalls: 1, contactCreates: 1 });

  const staleFailure = { ...event, id: "evt_importa7_stale_failure", type: "checkout.session.async_payment_failed" };
  const staleRaw = JSON.stringify(staleFailure);
  const staleResponse = await handler(new Request("https://ivanimports.es/api/importa-7-dias?action=webhook", {
    method: "POST", headers: { "stripe-signature": stripeHeader(staleRaw, env().STRIPE_WEBHOOK_SECRET, timestamp) }, body: staleRaw,
  }));
  assert.equal((await staleResponse.json()).ignored, "stale_payment_failure");
  assert.equal(JSON.parse(service.redis.get(`importa7:order:${sessionId}`)).status, "delivered");
});

test("un fallo conocido de Resend no marca entrega y el reintento posterior puede completarla", async () => {
  const service = createServiceMock({ failEmailTimes: 1 });
  const handler = createHandler({ env: env({ RESEND_IMPORTA_7_DIAS_SEGMENT_ID: "" }), fetchImpl: service.fetchImpl });
  const event = { id: "evt_importa7_retry", type: "checkout.session.completed", created: paidSession().created, data: { object: { id: sessionId } } };
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const request = () => new Request("https://ivanimports.es/api/importa-7-dias?action=webhook", {
    method: "POST", headers: { "stripe-signature": stripeHeader(raw, env().STRIPE_WEBHOOK_SECRET, timestamp) }, body: raw,
  });
  assert.equal((await handler(request())).status, 500);
  assert.equal((await handler(request())).status, 200);
  assert.equal(service.stats().emailCalls, 2);
  const stored = JSON.parse(service.redis.get(`importa7:order:${sessionId}`));
  assert.equal(stored.status, "delivered");
});

test("dos webhooks simultaneos quedan serializados por el lock y no duplican el email", async () => {
  let releaseEmail;
  let markEmailStarted;
  const emailStarted = new Promise((resolve) => { markEmailStarted = resolve; });
  const emailReleased = new Promise((resolve) => { releaseEmail = resolve; });
  const service = createServiceMock({
    emailGate: async () => {
      markEmailStarted();
      await emailReleased;
    },
  });
  const handler = createHandler({ env: env({ RESEND_IMPORTA_7_DIAS_SEGMENT_ID: "" }), fetchImpl: service.fetchImpl });
  const event = { id: "evt_importa7_concurrent", type: "checkout.session.completed", created: paidSession().created, data: { object: { id: sessionId } } };
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const request = () => new Request("https://ivanimports.es/api/importa-7-dias?action=webhook", {
    method: "POST", headers: { "stripe-signature": stripeHeader(raw, env().STRIPE_WEBHOOK_SECRET, timestamp) }, body: raw,
  });

  const firstPromise = handler(request());
  await emailStarted;
  const concurrent = await handler(request());
  assert.equal(concurrent.status, 500);
  assert.deepEqual(service.stats(), { emailCalls: 1, contactCreates: 0 });

  releaseEmail();
  const first = await firstPromise;
  assert.equal(first.status, 200);
  assert.equal((await first.json()).delivered, true);
  assert.deepEqual(service.stats(), { emailCalls: 1, contactCreates: 0 });
});

test("la descarga solo transmite un Blob privado para un pedido durable entregado", async () => {
  const service = createServiceMock();
  service.redis.set(`importa7:order:${sessionId}`, JSON.stringify({ status: "delivered", productSlug: "importa-en-7-dias" }));
  const token = buildDownloadToken({ sessionId, file: "guide", expiresAt: Math.floor(Date.now() / 1000) + 60, secret: signingSecret });
  let requestedPath = "";
  const handler = createHandler({
    env: env(), fetchImpl: service.fetchImpl,
    blobGet: async (pathname, options) => {
      requestedPath = pathname;
      assert.equal(options.access, "private");
      return { statusCode: 200, stream: new Blob(["%PDF-test"]).stream(), blob: { etag: "etag-test" } };
    },
  });
  const response = await handler(new Request(`https://ivanimports.es/api/importa-7-dias?action=download&file=guide&token=${encodeURIComponent(token)}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="Importa-tu-coche-en-7-dias-Guia-2026.pdf"');
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(requestedPath, "products/importa-7-dias/2026/guia-principal.pdf");
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), "%PDF-test");

  requestedPath = "";
  const tamperedResource = await handler(new Request(`https://ivanimports.es/api/importa-7-dias?action=download&file=workbook&token=${encodeURIComponent(token)}`));
  assert.equal(tamperedResource.status, 403);
  assert.equal(requestedPath, "");
});
