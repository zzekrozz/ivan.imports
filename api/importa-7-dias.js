import { createHmac, timingSafeEqual } from "node:crypto";
import { get as getPrivateBlob } from "@vercel/blob";

const PRODUCT_SLUG = "importa-en-7-dias";
const PRODUCT_NAME = "Importa tu coche en 7 días";
const DEFAULT_AMOUNT = 17900;
const DEFAULT_DOWNLOAD_TTL = 7 * 24 * 60 * 60;
const SUPPORT_DAYS = 14;
const LAUNCH_DEADLINE_SECONDS = Math.floor(Date.parse("2026-08-16T23:59:59+02:00") / 1000);
const ORDER_TTL_SECONDS = 5 * 365 * 24 * 60 * 60;
const RESEND_IDEMPOTENCY_SECONDS = 23 * 60 * 60;
const LOCK_TTL_SECONDS = 90;
const SESSION_PATTERN = /^cs_(?:test_|live_)?[A-Za-z0-9]{16,}$/;

function responseJson(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function safeError(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeBaseUrl(value) {
  return String(value || "https://ivanimports.es").replace(/\/$/, "");
}

function serverConfig(env = process.env) {
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || "",
    paymentLinkId: env.STRIPE_IMPORTA_7_DIAS_PAYMENT_LINK_ID || "",
    priceId: env.STRIPE_IMPORTA_7_DIAS_PRICE_ID || "",
    expectedAmount: Number(env.STRIPE_IMPORTA_7_DIAS_EXPECTED_AMOUNT || DEFAULT_AMOUNT),
    resendApiKey: env.RESEND_API_KEY || "",
    resendFrom: env.RESEND_FROM_EMAIL || "",
    resendSegmentId: env.RESEND_IMPORTA_7_DIAS_SEGMENT_ID || env.RESEND_IMPORTA_7_DIAS_AUDIENCE_ID || "",
    redisUrl: String(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || "").replace(/\/$/, ""),
    redisToken: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || "",
    guidePathname: env.IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME || "products/importa-7-dias/2026/guia-principal.pdf",
    workbookPathname: env.IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME || "products/importa-7-dias/2026/cuaderno-de-trabajo.pdf",
    signingSecret: env.IMPORTA_7_DIAS_DOWNLOAD_SIGNING_SECRET || "",
    downloadTtl: Number(env.IMPORTA_7_DIAS_DOWNLOAD_TTL_SECONDS || DEFAULT_DOWNLOAD_TTL),
    baseUrl: normalizeBaseUrl(env.IMPORTA_7_DIAS_BASE_URL),
    supportPhone: String(env.IMPORTA_7_DIAS_SUPPORT_PHONE_E164 || "").replace(/\D/g, ""),
    adminEmail: env.IMPORTA_7_DIAS_ADMIN_EMAIL || "",
    adminApiToken: env.IMPORTA_7_DIAS_ADMIN_API_TOKEN || "",
    vercelEnv: env.VERCEL_ENV || "development",
  };
}

function requireConfig(config, names) {
  const missing = names.filter((name) => !config[name]);
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(", ")}`);
}

export function maskEmail(email) {
  const normalized = String(email || "").trim();
  const at = normalized.lastIndexOf("@");
  if (at < 2) return "tu correo de compra";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.length <= 3 ? local[0] : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.min(6, Math.max(3, local.length - visible.length)))}@${domain}`;
}

export function isBonusEligible(paidAtSeconds) {
  return Number.isFinite(paidAtSeconds) && paidAtSeconds <= LAUNCH_DEADLINE_SECONDS;
}

export function supportExpiresAt(paidAtSeconds) {
  return paidAtSeconds + SUPPORT_DAYS * 24 * 60 * 60;
}

export function formatMadridDate(epochSeconds) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(epochSeconds * 1000));
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function buildDownloadToken({ sessionId, file, expiresAt, secret }) {
  if (!SESSION_PATTERN.test(sessionId)) throw new Error("Invalid Checkout Session ID");
  if (!new Set(["guide", "workbook"]).has(file)) throw new Error("Invalid download resource");
  if (!secret || secret.length < 32) throw new Error("Download signing secret must contain at least 32 characters");
  const payload = base64UrlEncode(JSON.stringify({ sid: sessionId, f: file, exp: expiresAt, p: PRODUCT_SLUG, v: 2 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyDownloadToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const [payload, providedSignature, extra] = String(token || "").split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = sign(payload, secret);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.p !== PRODUCT_SLUG || decoded.v !== 2 || !SESSION_PATTERN.test(decoded.sid)) return null;
    if (!new Set(["guide", "workbook"]).has(decoded.f)) return null;
    if (!Number.isFinite(decoded.exp) || decoded.exp <= nowSeconds) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyStripeSignature(payload, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!signatureHeader || !secret) throw new Error("Missing Stripe signature configuration");
  const parts = String(signatureHeader).split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isFinite(timestamp) || !signatures.length) throw new Error("Malformed Stripe signature");
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new Error("Stripe signature timestamp outside tolerance");

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const candidateBuffer = Buffer.from(candidate, "hex");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
  if (!valid) throw new Error("Invalid Stripe signature");
  return true;
}

function stripeHeaders(config) {
  return {
    Authorization: `Bearer ${config.stripeSecretKey}`,
    "User-Agent": "IvanImports-Importa7/1.0",
  };
}

async function retrieveCheckoutSession(sessionId, config, fetchImpl = fetch) {
  requireConfig(config, ["stripeSecretKey"]);
  if (!SESSION_PATTERN.test(sessionId)) throw Object.assign(new Error("Invalid Checkout Session ID"), { status: 400 });
  const params = new URLSearchParams();
  params.append("expand[]", "line_items.data.price");
  params.append("expand[]", "payment_intent.latest_charge");
  const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${params}`, {
    headers: stripeHeaders(config),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || "Stripe session lookup failed");
    error.status = response.status;
    error.stripeCode = body?.error?.code;
    throw error;
  }
  return body;
}

export function validateProductSession(session, config, { requirePaid = true } = {}) {
  const errors = [];
  if (session?.mode !== "payment") errors.push("mode");
  if (!config.paymentLinkId || session?.payment_link !== config.paymentLinkId) errors.push("payment_link");
  if (String(session?.currency || "").toLowerCase() !== "eur") errors.push("currency");
  if (Number(session?.amount_total) !== Number(config.expectedAmount)) errors.push("amount_total");
  if (requirePaid && session?.payment_status !== "paid") errors.push("payment_status");

  const items = session?.line_items?.data || [];
  const expectedItems = items.filter((item) => item?.price?.id === config.priceId);
  if (!config.priceId || expectedItems.length !== 1 || Number(expectedItems[0]?.quantity || 0) !== 1) errors.push("price_id");
  if (items.length !== 1) errors.push("line_items");

  return { valid: errors.length === 0, errors };
}

function paidAtFromSession(session, eventCreated) {
  const candidates = [
    session?.payment_intent?.latest_charge?.created,
    session?.payment_intent?.created,
    eventCreated,
    session?.created,
  ];
  return Number(candidates.find((value) => Number.isFinite(Number(value))));
}

async function redisCommand(config, command, fetchImpl = fetch) {
  requireConfig(config, ["redisUrl", "redisToken"]);
  const response = await fetchImpl(config.redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.redisToken}`,
      "Content-Type": "application/json",
      "User-Agent": "IvanImports-Importa7/1.0",
    },
    body: JSON.stringify(command),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error || `Redis command failed (${response.status})`);
  return body.result;
}

function orderKey(sessionId) {
  return `importa7:order:${sessionId}`;
}

async function getOrder(sessionId, config, fetchImpl = fetch) {
  const result = await redisCommand(config, ["GET", orderKey(sessionId)], fetchImpl);
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

async function setOrder(sessionId, order, config, fetchImpl = fetch) {
  await redisCommand(config, ["SET", orderKey(sessionId), JSON.stringify(order), "EX", String(ORDER_TTL_SECONDS)], fetchImpl);
  return order;
}

async function acquireLock(sessionId, eventId, config, fetchImpl = fetch) {
  const key = `importa7:lock:${sessionId}`;
  const result = await redisCommand(config, ["SET", key, eventId, "NX", "EX", String(LOCK_TTL_SECONDS)], fetchImpl);
  return result === "OK";
}

async function releaseLock(sessionId, eventId, config, fetchImpl = fetch) {
  const key = `importa7:lock:${sessionId}`;
  const script = "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end";
  await redisCommand(config, ["EVAL", script, "1", key, eventId], fetchImpl).catch(() => {});
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
}

function customerFirstName(session) {
  const name = String(session?.customer_details?.name || "").trim();
  return name ? name.split(/\s+/)[0].slice(0, 80) : "";
}

function whatsappLink(phone, email) {
  if (!/^\d{8,15}$/.test(phone)) return "";
  const text = `Hola Iván, he comprado ${PRODUCT_NAME}. El email que utilicé en la compra es: ${email}. Mi duda es:`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function buildCustomerEmail({ session, paidAt, bonusEligible, supportEnd, guideUrl, workbookUrl, downloadExpiresAt, config }) {
  const email = session.customer_details?.email || session.customer_email || "";
  const firstName = customerFirstName(session);
  const greeting = firstName ? `Hola ${escapeHtml(firstName)},` : "Hola,";
  const supportUrl = bonusEligible ? whatsappLink(config.supportPhone, email) : "";
  const expiry = formatMadridDate(downloadExpiresAt);
  const supportExpiry = bonusEligible ? formatMadridDate(supportEnd) : "";
  const preheader = "Tu guía, tu cuaderno de trabajo y, si corresponde, 14 días de acompañamiento ya están preparados.";

  const button = (label, url) => `<a href="${escapeHtml(url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:15px 20px;border-radius:7px;background:#f4b923;color:#071827;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:.05em;">${escapeHtml(label)}</a>`;
  const bonusHtml = bonusEligible ? `
    <tr><td style="padding:0 28px 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d263d;border:1px solid #365068;border-radius:14px;"><tr>
      <td style="padding:28px;color:#ffffff;"><p style="margin:0 0 8px;color:#f4b923;font-size:11px;font-weight:800;letter-spacing:.12em;">BONUS DE LANZAMIENTO</p>
      <h2 style="margin:0 0 14px;font-size:24px;line-height:1.2;">14 días de Acompañamiento de Primera Importación</h2>
      <p style="margin:0 0 14px;color:#d6dee5;line-height:1.65;">Como has comprado antes del domingo 16 de agosto a las 23:59, tu compra incluye 14 días de acompañamiento directo conmigo.</p>
      <p style="margin:0 0 14px;color:#d6dee5;line-height:1.65;">Puedes escribirme por WhatsApp con dudas concretas sobre el curso o tu importación: vehículo, documentación, vendedor, costes, viaje, revisión, placas, ITV o matriculación.</p>
      <p style="margin:0 0 18px;color:#d6dee5;line-height:1.65;">Indícame el mismo email de la compra: <strong style="color:#fff;">${escapeHtml(email)}</strong><br>Tu acompañamiento estará activo hasta: <strong style="color:#fff;">${escapeHtml(supportExpiry)}</strong></p>
      ${supportUrl ? button("ESCRIBIR A IVÁN POR WHATSAPP", supportUrl) : ""}
      <p style="margin:16px 0 0;color:#9fb0bf;font-size:12px;line-height:1.55;">El acompañamiento está pensado para dudas concretas y aplicación del sistema. No incluye búsqueda integral ilimitada, representación administrativa ni gestión completa de la operación.</p>
      </td></tr></table></td></tr>` : "";

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ya tienes acceso a ${PRODUCT_NAME}</title></head>
  <body style="margin:0;background:#eef2f5;font-family:Arial,Helvetica,sans-serif;color:#102231;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f5;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 12px 35px rgba(7,24,39,.08);">
    <tr><td style="padding:24px 28px;background:#071827;color:#fff;font-size:16px;font-weight:800;letter-spacing:.18em;">IVAN<span style="color:#f4b923;">IMPORTS</span></td></tr>
    <tr><td style="padding:38px 28px 24px;"><p style="margin:0 0 12px;color:#927019;font-size:12px;font-weight:800;letter-spacing:.1em;">COMPRA CONFIRMADA</p><h1 style="margin:0 0 22px;font-size:34px;line-height:1.1;color:#071827;">Felicidades. Ya has dado el primer paso.</h1>
    <p style="margin:0 0 16px;line-height:1.7;">${greeting}</p><p style="margin:0 0 16px;line-height:1.7;">Gracias por confiar en IvanImports.</p>
    <p style="margin:0 0 16px;line-height:1.7;">Has dado un paso importante: en lugar de improvisar una operación de miles de euros, ahora tienes un sistema para entenderla y prepararla de principio a fin.</p>
    <p style="margin:0;line-height:1.7;">Dentro encontrarás el proceso para buscar, comparar, comprobar, negociar, comprar, traer y matricular un vehículo desde Europa hasta España.</p></td></tr>
    <tr><td style="padding:0 28px 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fa;border:1px solid #dfe5ea;border-radius:14px;"><tr><td style="padding:26px;">
      <h2 style="margin:0 0 12px;font-size:24px;color:#071827;">Tu sistema ya está listo</h2>
      <p style="margin:0 0 8px;line-height:1.6;"><strong>Guía principal</strong> · Importa tu coche en 7 días</p><p style="margin:0 0 18px;line-height:1.6;"><strong>Cuaderno de trabajo</strong> · Aplica el sistema a tu vehículo</p>
      ${button("ABRIR GUÍA PRINCIPAL", guideUrl)}${button("ABRIR CUADERNO DE TRABAJO", workbookUrl)}
      <p style="margin:16px 0 0;color:#667581;font-size:12px;line-height:1.55;">Los enlaces privados caducan el ${escapeHtml(expiry)}. Guarda los archivos y conserva este email. Será nuestra referencia para actualizaciones y el futuro acceso a la plataforma.</p>
    </td></tr></table></td></tr>
    <tr><td style="padding:4px 28px 28px;"><h2 style="margin:0 0 14px;font-size:24px;color:#071827;">Mi recomendación para empezar</h2>
      <p style="margin:0 0 16px;line-height:1.7;">Haz primero una lectura general para entender cómo encajan todas las piezas. No intentes memorizar las 150 páginas.</p>
      <p style="margin:0 0 16px;line-height:1.7;">Después, cuando encuentres un vehículo que realmente estés valorando, abre el cuaderno de trabajo y crea una ficha para esa operación. Vuelve al capítulo que necesites cuando aparezca cada duda.</p>
      <ol style="margin:0;padding-left:22px;line-height:1.9;"><li>Guarda la guía y el cuaderno.</li><li>Lee primero el recorrido completo.</li><li>Abre una ficha cuando aparezca un candidato serio.</li></ol>
    </td></tr>
    ${bonusHtml}
    <tr><td style="padding:0 28px 30px;"><h2 style="margin:0 0 14px;font-size:24px;color:#071827;">Tu acceso seguirá creciendo</h2>
      <p style="margin:0 0 14px;line-height:1.7;">Utilizaré este mismo correo para enviarte actualizaciones relevantes del producto: nuevas versiones, vídeos, clases, recursos y cambios importantes del proceso.</p>
      <p style="margin:0 0 14px;line-height:1.7;">Cuando esté lista la plataforma interactiva, recibirás acceso sin coste adicional utilizando este mismo email. No tendrás que comprar de nuevo el producto.</p>
      <p style="margin:0;color:#667581;font-size:12px;line-height:1.55;">Estos mensajes estarán relacionados con el producto comprado. Esta compra no te suscribe a campañas comerciales generales.</p>
    </td></tr>
    <tr><td style="padding:28px;background:#071827;color:#dce4eb;"><p style="margin:0 0 16px;line-height:1.7;">Estás empezando por el lugar correcto: entender el proceso antes de poner miles de euros sobre la mesa. Cuando aparezca el coche adecuado, ya tendrás una carretera mucho más señalizada.</p>
      <p style="margin:0 0 18px;color:#fff;font-weight:700;">Bienvenido a Importa tu coche en 7 días.</p><p style="margin:0 0 18px;line-height:1.5;">Iván<br><strong style="color:#f4b923;">IvanImports</strong></p>
      <p style="margin:0;color:#9fb0bf;font-size:12px;line-height:1.5;">Este correo es automático y no admite respuestas. Para contactar con IvanImports, utiliza los canales disponibles en la web.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;

  const bonusText = bonusEligible ? `\nBONUS DE LANZAMIENTO\n14 días de Acompañamiento de Primera Importación\n\nComo has comprado antes del domingo 16 de agosto a las 23:59, tu compra incluye 14 días de acompañamiento directo conmigo.\n\nDurante este periodo puedes escribirme por WhatsApp con dudas concretas relacionadas con el curso o la importación que estés preparando: vehículo candidato, documentación, vendedor, costes, viaje, revisión, placas, ITV o matriculación.\n\nCuando me escribas, indícame el mismo email de la compra: ${email}\nTu acompañamiento estará activo hasta: ${supportExpiry}\n${supportUrl ? `WhatsApp: ${supportUrl}\n` : ""}\nEl acompañamiento está pensado para dudas concretas y aplicación del sistema. No incluye búsqueda integral ilimitada, representación administrativa ni gestión completa de la operación.\n` : "";
  const text = `${firstName ? `Hola ${firstName},` : "Hola,"}\n\nFelicidades. Ya has dado el primer paso.\n\nGracias por confiar en IvanImports.\n\nHas dado un paso importante: en lugar de improvisar una operación de miles de euros, ahora tienes un sistema para entenderla y prepararla de principio a fin.\n\nDentro encontrarás el proceso para buscar, comparar, comprobar, negociar, comprar, traer y matricular un vehículo desde Europa hasta España.\n\nTU SISTEMA YA ESTÁ LISTO\nGuía principal · Importa tu coche en 7 días:\n${guideUrl}\n\nCuaderno de trabajo · Aplica el sistema a tu vehículo:\n${workbookUrl}\n\nEstos enlaces privados caducan el ${expiry}. Guarda ambos archivos y conserva este email. Será nuestra referencia para enviarte actualizaciones y el futuro acceso a la plataforma.\n\nMI RECOMENDACIÓN PARA EMPEZAR\nHaz primero una lectura general para entender cómo encajan todas las piezas. No intentes memorizar las 150 páginas. Después, cuando encuentres un vehículo que realmente estés valorando, abre el cuaderno y crea una ficha para esa operación.\n\n1. Guarda la guía y el cuaderno.\n2. Lee primero el recorrido completo.\n3. Abre una ficha cuando aparezca un candidato serio.\n${bonusText}\nTU ACCESO SEGUIRÁ CRECIENDO\n\nUtilizaré este mismo correo para enviarte actualizaciones relevantes del producto:\n- nuevas versiones mejoradas de la formación;\n- vídeos y clases que se incorporen;\n- materiales y recursos adicionales;\n- cambios importantes que afecten al proceso.\n\nCuando esté lista la plataforma interactiva, recibirás acceso sin coste adicional utilizando este mismo email. No tendrás que comprar de nuevo el producto.\n\nEstos mensajes estarán relacionados con el producto comprado. Esta compra no te suscribe a campañas comerciales generales.\n\nEstás empezando por el lugar correcto: entender el proceso antes de poner miles de euros sobre la mesa.\n\nCuando aparezca el coche adecuado, ya tendrás una carretera mucho más señalizada.\n\nBienvenido a Importa tu coche en 7 días.\n\nIván\nIvanImports\n\nPuedes responder directamente a este correo si tienes un problema con la entrega del material.`;

  const outboundOnlyText = text.replace(
    "Puedes responder directamente a este correo si tienes un problema con la entrega del material.",
    `Este correo es automático y no admite respuestas. Para contactar con IvanImports, visita ${config.baseUrl}/#contacto.`,
  );

  return {
    from: config.resendFrom,
    to: [email],
    subject: "Ya tienes acceso a Importa tu coche en 7 días",
    html,
    text: outboundOnlyText,
    tags: [
      { name: "product", value: PRODUCT_SLUG },
      { name: "email_type", value: "fulfillment" },
    ],
  };
}

async function resendRequest(path, options, config, fetchImpl = fetch) {
  requireConfig(config, ["resendApiKey"]);
  let response;
  try {
    response = await fetchImpl(`https://api.resend.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "IvanImports-Importa7/1.0",
        ...(options.headers || {}),
      },
    });
  } catch (cause) {
    const error = new Error("Resend request outcome is unknown");
    error.ambiguous = true;
    error.cause = cause;
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message || `Resend request failed (${response.status})`);
    error.status = response.status;
    error.ambiguous = false;
    throw error;
  }
  return body;
}

async function sendCustomerEmail(payload, sessionId, config, fetchImpl = fetch, suffix = "fulfillment") {
  requireConfig(config, ["resendFrom"]);
  return resendRequest("/emails", {
    method: "POST",
    headers: { "Idempotency-Key": `importa7-${suffix}/${sessionId}`.slice(0, 256) },
    body: JSON.stringify(payload),
  }, config, fetchImpl);
}

async function updateBuyerContact(order, config, fetchImpl = fetch) {
  if (!config.resendSegmentId) return { skipped: true };
  const properties = {
    product_slug: PRODUCT_SLUG,
    purchased_at: order.purchasedAt,
    bonus_eligible: String(order.bonusEligible),
    support_expires_at: order.supportExpiresAt || "",
    stripe_checkout_session_id: order.checkoutSessionId,
    general_marketing_consent: "false",
  };
  const lookup = await fetchImpl(`https://api.resend.com/contacts/${encodeURIComponent(order.email)}`, {
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "User-Agent": "IvanImports-Importa7/1.0",
    },
  });
  if (lookup.status === 404) {
    return resendRequest("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email: order.email,
        first_name: order.firstName || undefined,
        unsubscribed: false,
        properties,
        segments: [{ id: config.resendSegmentId }],
      }),
    }, config, fetchImpl);
  }
  if (!lookup.ok) throw new Error(`Resend contact lookup failed (${lookup.status})`);
  const contact = await lookup.json();
  const contactId = contact.id || order.email;
  const updated = await resendRequest(`/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    body: JSON.stringify({ unsubscribed: false, properties }),
  }, config, fetchImpl);
  await resendRequest(`/contacts/${encodeURIComponent(contactId)}/segments/${encodeURIComponent(config.resendSegmentId)}`, {
    method: "POST",
    body: "{}",
  }, config, fetchImpl);
  return updated;
}

async function sendAdminEmail(order, config, fetchImpl = fetch) {
  if (!config.adminEmail) return { skipped: true };
  const support = order.bonusEligible ? formatMadridDate(Math.floor(Date.parse(order.supportExpiresAt) / 1000)) : "No aplicable";
  const payload = {
    from: config.resendFrom,
    to: [config.adminEmail],
    subject: "Nueva venta · Importa tu coche en 7 días",
    html: `<h1>Nueva venta</h1><p><strong>Email:</strong> ${escapeHtml(order.email)}</p><p><strong>Fecha:</strong> ${escapeHtml(order.purchasedAt)}</p><p><strong>Importe:</strong> 179 €</p><p><strong>Session:</strong> ${escapeHtml(order.checkoutSessionId)}</p><p><strong>Bonus:</strong> ${order.bonusEligible ? "Sí" : "No"}</p><p><strong>Fin de acompañamiento:</strong> ${escapeHtml(support)}</p>`,
    text: `Nueva venta\nEmail: ${order.email}\nFecha: ${order.purchasedAt}\nImporte: 179 €\nSession: ${order.checkoutSessionId}\nBonus: ${order.bonusEligible ? "Sí" : "No"}\nFin de acompañamiento: ${support}`,
  };
  return resendRequest("/emails", {
    method: "POST",
    headers: { "Idempotency-Key": `importa7-admin/${order.checkoutSessionId}` },
    body: JSON.stringify(payload),
  }, config, fetchImpl);
}

function logEvent(event, details = {}) {
  console.info(JSON.stringify({ event, product: PRODUCT_SLUG, ...details }));
}

async function fulfillmentPayload(session, paidAt, config, expiresAtOverride) {
  const bonusEligible = isBonusEligible(paidAt);
  const supportEnd = bonusEligible ? supportExpiresAt(paidAt) : null;
  const downloadExpiresAt = expiresAtOverride || paidAt + config.downloadTtl;
  const guideToken = buildDownloadToken({ sessionId: session.id, file: "guide", expiresAt: downloadExpiresAt, secret: config.signingSecret });
  const workbookToken = buildDownloadToken({ sessionId: session.id, file: "workbook", expiresAt: downloadExpiresAt, secret: config.signingSecret });
  return {
    bonusEligible,
    supportEnd,
    downloadExpiresAt,
    guideUrl: `${config.baseUrl}/api/importa-7-dias/download?file=guide&token=${encodeURIComponent(guideToken)}`,
    workbookUrl: `${config.baseUrl}/api/importa-7-dias/download?file=workbook&token=${encodeURIComponent(workbookToken)}`,
  };
}

async function fulfillPaidSession(session, event, config, fetchImpl = fetch) {
  requireConfig(config, ["redisUrl", "redisToken", "resendApiKey", "resendFrom", "signingSecret"]);
  const email = session.customer_details?.email || session.customer_email;
  if (!email) throw new Error("Paid session has no customer email");
  const sessionId = session.id;
  const locked = await acquireLock(sessionId, event.id, config, fetchImpl);
  if (!locked) {
    const existing = await getOrder(sessionId, config, fetchImpl);
    if (existing?.status === "delivered") return { duplicate: true, order: existing };
    const error = new Error("Fulfillment already in progress");
    error.status = 409;
    throw error;
  }

  try {
    let existing = await getOrder(sessionId, config, fetchImpl);
    if (existing?.status === "delivered") return { duplicate: true, order: existing };

    const now = Math.floor(Date.now() / 1000);
    if (existing?.status === "sending") {
      const sendingSince = Math.floor(Date.parse(existing.sendingStartedAt || 0) / 1000);
      if (sendingSince && now - sendingSince > RESEND_IDEMPOTENCY_SECONDS) {
        existing = await setOrder(sessionId, {
          ...existing,
          status: "needs_review",
          lastError: "Ambiguous Resend outcome exceeded its 24-hour idempotency window; automatic resend stopped to prevent duplication.",
          updatedAt: new Date().toISOString(),
        }, config, fetchImpl);
        logEvent("importa7_email_fulfillment_failed", { session_ref: sessionId.slice(-8), reason: "needs_review" });
        return { needsReview: true, order: existing };
      }
    }

    const paidAt = existing?.paidAtSeconds || paidAtFromSession(session, event.created);
    if (!Number.isFinite(paidAt)) throw new Error("Unable to determine paid timestamp");
    const product = validateProductSession(session, config, { requirePaid: true });
    if (!product.valid) throw new Error(`Paid session failed product validation: ${product.errors.join(", ")}`);
    const existingExpiry = Math.floor(Date.parse(existing?.downloadExpiresAt || "") / 1000);
    const stableDownloadExpiry = Number.isFinite(existingExpiry) ? existingExpiry : now + config.downloadTtl;
    const delivery = await fulfillmentPayload(session, paidAt, config, stableDownloadExpiry);
    const order = {
      status: "sending",
      productSlug: PRODUCT_SLUG,
      checkoutSessionId: sessionId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || "",
      email,
      firstName: customerFirstName(session),
      amountTotal: session.amount_total,
      currency: session.currency,
      paidAtSeconds: paidAt,
      purchasedAt: new Date(paidAt * 1000).toISOString(),
      bonusEligible: delivery.bonusEligible,
      supportExpiresAt: delivery.supportEnd ? new Date(delivery.supportEnd * 1000).toISOString() : "",
      downloadExpiresAt: new Date(delivery.downloadExpiresAt * 1000).toISOString(),
      eventId: event.id,
      sendingStartedAt: existing?.sendingStartedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setOrder(sessionId, order, config, fetchImpl);

    const payload = buildCustomerEmail({
      session,
      paidAt,
      bonusEligible: delivery.bonusEligible,
      supportEnd: delivery.supportEnd,
      guideUrl: delivery.guideUrl,
      workbookUrl: delivery.workbookUrl,
      downloadExpiresAt: delivery.downloadExpiresAt,
      config,
    });

    let emailResult;
    try {
      emailResult = await sendCustomerEmail(payload, sessionId, config, fetchImpl);
    } catch (error) {
      if (!error.ambiguous) {
        await setOrder(sessionId, {
          ...order,
          status: "failed",
          lastError: safeError(error).slice(0, 300),
          updatedAt: new Date().toISOString(),
        }, config, fetchImpl);
      }
      logEvent("importa7_email_fulfillment_failed", { session_ref: sessionId.slice(-8), ambiguous: Boolean(error.ambiguous) });
      throw error;
    }

    const completed = await setOrder(sessionId, {
      ...order,
      status: "delivered",
      resendEmailId: emailResult.id || "",
      deliveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, config, fetchImpl);
    logEvent("importa7_email_fulfillment_success", { session_ref: sessionId.slice(-8), bonus_eligible: delivery.bonusEligible });

    await Promise.allSettled([
      updateBuyerContact(completed, config, fetchImpl).catch((error) => logEvent("importa7_buyer_registry_failed", { session_ref: sessionId.slice(-8), reason: safeError(error).slice(0, 120) })),
      sendAdminEmail(completed, config, fetchImpl).catch((error) => logEvent("importa7_admin_email_failed", { session_ref: sessionId.slice(-8), reason: safeError(error).slice(0, 120) })),
    ]);
    return { duplicate: false, order: completed };
  } finally {
    await releaseLock(sessionId, event.id, config, fetchImpl);
  }
}

async function handleWebhook(request, config, fetchImpl = fetch) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireConfig(config, ["stripeWebhookSecret", "stripeSecretKey", "paymentLinkId", "priceId"]);
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  try {
    verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret);
  } catch {
    return responseJson({ error: "invalid_signature" }, 400);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return responseJson({ error: "invalid_json" }, 400); }
  const allowed = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);
  if (!allowed.has(event.type)) return responseJson({ received: true, ignored: true });
  const sessionId = event?.data?.object?.id;
  if (!SESSION_PATTERN.test(sessionId || "")) return responseJson({ error: "invalid_session" }, 400);

  try {
    const session = await retrieveCheckoutSession(sessionId, config, fetchImpl);
    const product = validateProductSession(session, config, { requirePaid: false });
    if (!product.valid) {
      logEvent("importa7_webhook_rejected", { session_ref: sessionId.slice(-8), checks: product.errors });
      return responseJson({ error: "product_mismatch" }, 400);
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const existing = await getOrder(sessionId, config, fetchImpl);
      if (existing?.status === "delivered") {
        return responseJson({ received: true, delivered: true, ignored: "stale_payment_failure" });
      }
      await setOrder(sessionId, {
        status: "payment_failed",
        checkoutSessionId: sessionId,
        productSlug: PRODUCT_SLUG,
        updatedAt: new Date().toISOString(),
      }, config, fetchImpl);
      return responseJson({ received: true, delivered: false });
    }
    if (session.payment_status !== "paid") {
      await setOrder(sessionId, {
        status: "payment_pending",
        checkoutSessionId: sessionId,
        productSlug: PRODUCT_SLUG,
        updatedAt: new Date().toISOString(),
      }, config, fetchImpl);
      return responseJson({ received: true, pending: true });
    }

    const result = await fulfillPaidSession(session, event, config, fetchImpl);
    return responseJson({ received: true, delivered: result.order?.status === "delivered", duplicate: Boolean(result.duplicate), needs_review: Boolean(result.needsReview) });
  } catch (error) {
    logEvent("importa7_webhook_error", { session_ref: sessionId.slice(-8), reason: safeError(error).slice(0, 120) });
    return responseJson({ error: "fulfillment_failed" }, 500);
  }
}

function assertTrustedOrigin(request, config) {
  if (config.vercelEnv !== "production") return true;
  const origin = request.headers.get("origin");
  return !origin || origin === config.baseUrl;
}

async function handleOrderStatus(request, config, fetchImpl = fetch) {
  if (request.method !== "POST") return responseJson({ status: "unverified" }, 405, { Allow: "POST" });
  if (!assertTrustedOrigin(request, config)) return responseJson({ status: "unverified" }, 403);
  let body;
  try { body = await request.json(); } catch { return responseJson({ status: "unverified" }, 400); }
  const sessionId = String(body?.session_id || "");
  if (!SESSION_PATTERN.test(sessionId)) return responseJson({ status: "unverified" }, 400);
  requireConfig(config, ["stripeSecretKey", "paymentLinkId", "priceId"]);

  try {
    const session = await retrieveCheckoutSession(sessionId, config, fetchImpl);
    const product = validateProductSession(session, config, { requirePaid: false });
    if (!product.valid) return responseJson({ status: "unverified" }, 404);
    const email = session.customer_details?.email || session.customer_email || "";
    if (session.payment_status !== "paid") {
      return responseJson({ status: "pending", masked_email: maskEmail(email) });
    }
    const paidAt = paidAtFromSession(session, session.created);
    const bonusEligible = isBonusEligible(paidAt);
    const supportEnd = bonusEligible ? supportExpiresAt(paidAt) : null;
    return responseJson({
      status: "confirmed",
      masked_email: maskEmail(email),
      bonus_eligible: bonusEligible,
      support_expires_at: supportEnd ? new Date(supportEnd * 1000).toISOString() : null,
    });
  } catch (error) {
    if (error.status === 404 || error.stripeCode === "resource_missing") return responseJson({ status: "unverified" }, 404);
    return responseJson({ status: "unverified" }, 503);
  }
}

async function handleDownload(request, config, blobGet = getPrivateBlob, fetchImpl = fetch) {
  if (request.method !== "GET") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "GET" });
  requireConfig(config, ["signingSecret", "redisUrl", "redisToken"]);
  const url = new URL(request.url);
  const file = url.searchParams.get("file");
  const token = url.searchParams.get("token");
  if (!new Set(["guide", "workbook"]).has(file)) return responseJson({ error: "invalid_file" }, 400);
  const decoded = verifyDownloadToken(token, config.signingSecret);
  if (!decoded) return responseJson({ error: "link_expired_or_invalid" }, 403);
  if (decoded.f !== file) return responseJson({ error: "link_expired_or_invalid" }, 403);
  const order = await getOrder(decoded.sid, config, fetchImpl);
  if (!order || order.status !== "delivered" || order.productSlug !== PRODUCT_SLUG) return responseJson({ error: "order_not_available" }, 403);

  const pathname = file === "guide" ? config.guidePathname : config.workbookPathname;
  const filename = file === "guide" ? "Importa-tu-coche-en-7-dias-Guia-2026.pdf" : "Importa-tu-coche-en-7-dias-Cuaderno-de-trabajo-2026.pdf";
  const result = await blobGet(pathname, { access: "private", ifNoneMatch: request.headers.get("if-none-match") || undefined });
  if (!result) return responseJson({ error: "file_not_found" }, 404);
  if (result.statusCode === 304) {
    return new Response(null, { status: 304, headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" } });
  }
  if (result.statusCode !== 200) return responseJson({ error: "file_not_found" }, 404);
  return new Response(result.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ETag: result.blob.etag,
    },
  });
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function handleReissue(request, config, fetchImpl = fetch) {
  if (request.method !== "POST") return responseJson({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  requireConfig(config, ["adminApiToken", "stripeSecretKey", "paymentLinkId", "priceId", "signingSecret", "resendApiKey", "resendFrom"]);
  const provided = Buffer.from(bearerToken(request));
  const expected = Buffer.from(config.adminApiToken);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return responseJson({ error: "unauthorized" }, 401);
  let body;
  try { body = await request.json(); } catch { return responseJson({ error: "invalid_json" }, 400); }
  const sessionId = String(body?.session_id || "");
  if (!SESSION_PATTERN.test(sessionId)) return responseJson({ error: "invalid_session" }, 400);
  const session = await retrieveCheckoutSession(sessionId, config, fetchImpl);
  const product = validateProductSession(session, config, { requirePaid: true });
  if (!product.valid) return responseJson({ error: "order_not_eligible" }, 403);
  const paidAt = paidAtFromSession(session, session.created);
  const expiresAt = Math.floor(Date.now() / 1000) + config.downloadTtl;
  const delivery = await fulfillmentPayload(session, paidAt, config, expiresAt);
  const payload = buildCustomerEmail({ session, paidAt, bonusEligible: delivery.bonusEligible, supportEnd: delivery.supportEnd, guideUrl: delivery.guideUrl, workbookUrl: delivery.workbookUrl, downloadExpiresAt: expiresAt, config });
  const result = await sendCustomerEmail(payload, `${sessionId}/${expiresAt}`, config, fetchImpl, "reissue");
  return responseJson({ sent: true, email_id: result.id || null, expires_at: new Date(expiresAt * 1000).toISOString() });
}

export function resolveAction(request) {
  return new URL(request.url).searchParams.get("action") || "";
}

export function createHandler({ env = process.env, fetchImpl = fetch, blobGet = getPrivateBlob } = {}) {
  return async function handler(request) {
    const config = serverConfig(env);
    const action = resolveAction(request);
    try {
      if (action === "webhook") return await handleWebhook(request, config, fetchImpl);
      if (action === "order-status") return await handleOrderStatus(request, config, fetchImpl);
      if (action === "download") return await handleDownload(request, config, blobGet, fetchImpl);
      if (action === "reissue") return await handleReissue(request, config, fetchImpl);
      return responseJson({ error: "not_found" }, 404);
    } catch (error) {
      logEvent("importa7_function_error", { action, reason: safeError(error).slice(0, 120) });
      return responseJson({ error: "service_unavailable" }, error.status || 503);
    }
  };
}

const handler = createHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
