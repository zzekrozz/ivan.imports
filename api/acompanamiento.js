const EXPECTED_AMOUNT = 99700;
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

function configFromEnv(env = process.env) {
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY || "",
    priceId: env.STRIPE_ACOMPANAMIENTO_PRICE_ID || "",
    vercelEnv: env.VERCEL_ENV || "development",
  };
}

function requireConfig(config) {
  const missing = ["stripeSecretKey", "priceId"].filter((name) => !config[name]);
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(", ")}`);
}

function trustedOrigin(request, config) {
  if (config.vercelEnv !== "production") return true;
  const origin = request.headers.get("origin");
  return !origin || origin === "https://ivanimports.es";
}

async function retrieveCheckoutSession(sessionId, config, fetchImpl = fetch) {
  requireConfig(config);
  const params = new URLSearchParams();
  params.append("expand[]", "line_items.data.price");
  const response = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${params}`, {
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "User-Agent": "IvanImports-Acompanamiento/1.0",
    },
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

export function validateAccompanimentSession(session, config) {
  const errors = [];
  if (session?.mode !== "payment") errors.push("mode");
  if (String(session?.currency || "").toLowerCase() !== "eur") errors.push("currency");
  if (Number(session?.amount_total) !== EXPECTED_AMOUNT) errors.push("amount_total");

  const items = session?.line_items?.data || [];
  if (items.length !== 1) errors.push("line_items");
  const item = items[0];
  if (!config.priceId || item?.price?.id !== config.priceId) errors.push("price_id");
  if (Number(item?.quantity || 0) !== 1) errors.push("quantity");
  if (Number(item?.amount_total) !== EXPECTED_AMOUNT) errors.push("line_item_amount");

  return { valid: errors.length === 0, errors };
}

function logStatus(event, fields = {}) {
  console.info(JSON.stringify({ event, product: "acompanamiento-completo", ...fields }));
}

export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(request) {
    const config = configFromEnv(env);
    const action = new URL(request.url).searchParams.get("action") || "";
    if (action !== "status") return responseJson({ status: "unverified" }, 404);
    if (request.method !== "POST") return responseJson({ status: "unverified" }, 405, { Allow: "POST" });
    if (!trustedOrigin(request, config)) return responseJson({ status: "unverified" }, 403);

    let body;
    try {
      body = await request.json();
    } catch {
      return responseJson({ status: "unverified" }, 400);
    }

    const sessionId = String(body?.session_id || "");
    if (!SESSION_PATTERN.test(sessionId)) return responseJson({ status: "unverified" }, 400);

    try {
      const session = await retrieveCheckoutSession(sessionId, config, fetchImpl);
      const product = validateAccompanimentSession(session, config);
      if (!product.valid) {
        logStatus("accompaniment_session_rejected", { session_ref: sessionId.slice(-8), checks: product.errors });
        return responseJson({ status: "unverified" }, 404);
      }
      if (session.payment_status !== "paid" || session.status !== "complete") {
        return responseJson({ status: "pending" });
      }
      return responseJson({ status: "confirmed" });
    } catch (error) {
      const missing = error.status === 404 || error.stripeCode === "resource_missing";
      logStatus("accompaniment_status_error", { session_ref: sessionId.slice(-8), reason: safeError(error).slice(0, 120) });
      return responseJson({ status: "unverified" }, missing ? 404 : 503);
    }
  };
}

const handler = createHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
