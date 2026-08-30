import { createHmac, randomBytes } from "node:crypto";
import { enrichReport } from "./_ivi/engine.js";
import { meaningfulVehicleData, normalizeOneAutoResponse } from "./_ivi/schema.js";
import { OneAutoError, OneAutoProvider } from "./_ivi/one-auto.js";
import { createAccessToken, createIVIRepository, hashToken, publicReport, verifyToken } from "./_ivi/repository.js";
import { validateAnalysisInput } from "./_ivi/validation.js";
import { generateIVIPdf } from "./_ivi/pdf.js";

const ERROR_MESSAGES = Object.freeze({
  invalid_json: "La solicitud no contiene JSON válido.",
  invalid_input: "Revisa los datos indicados.",
  not_configured: "IVI todavía no está habilitado en este entorno.",
  report_not_found: "No hemos encontrado este informe.",
  report_not_ready: "El informe todavía no está listo para PDF.",
  unauthorized: "El enlace de acceso al informe no es válido.",
  method_not_allowed: "Método no permitido.",
});

const secureHeaders = Object.freeze({ "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
const json = (body, status = 200, extraHeaders = {}) => Response.json(body, { status, headers: { ...secureHeaders, ...extraHeaders } });

function reportId(now = new Date(), randomBytesImpl = randomBytes) {
  return `IVI-${now.getUTCFullYear()}-${randomBytesImpl(4).toString("hex").toUpperCase()}`;
}

function callbackToken(id, secret) {
  return createHmac("sha256", secret).update(`ivi-callback:${id}`).digest("base64url");
}

function actionFor(request) {
  const url = new URL(request.url);
  return url.searchParams.get("action") || url.pathname.split("/").filter(Boolean).at(-1) || "";
}

function bearer(request) {
  const authorization = request.headers.get("authorization") || "";
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, "").trim();
  return new URL(request.url).searchParams.get("token") || "";
}

function reportAccess(report, request) {
  return Boolean(report?.accessTokenHash && verifyToken(bearer(request), report.accessTokenHash));
}

async function safeIncrement(repository, metric) {
  try { await repository.increment(metric); } catch { /* analytics never breaks reports */ }
}

async function readJson(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw Object.assign(new Error("invalid_json"), { code: "invalid_json", status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 20_000) throw Object.assign(new Error("invalid_json"), { code: "invalid_json", status: 413 });
  try { return await request.json(); } catch { throw Object.assign(new Error("invalid_json"), { code: "invalid_json", status: 400 }); }
}

function providerFrom(env, fetchImpl) {
  return new OneAutoProvider({ apiKey: env.ONE_AUTO_API_KEY, sandbox: env.ONE_AUTO_SANDBOX !== "false", timeoutMs: Number(env.ONE_AUTO_TIMEOUT_MS) || 20_000, fetchImpl });
}

function callbackUrlFor(env, id, token) {
  const base = String(env.IVI_BASE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  const url = new URL("/api/ivi/webhook", base);
  url.searchParams.set("reportId", id);
  url.searchParams.set("token", token);
  return url.toString();
}

function completedReport(report, payload, state, now, identityPayload = null) {
  const vehicle = normalizeOneAutoResponse(payload, { vin: report.inputs.vin, retrievedAt: now, identityPayload });
  const available = meaningfulVehicleData(vehicle);
  const normalizedState = state === "PARTIAL" || (available > 0 && (!vehicle.identity.manufacturer.value || !vehicle.identity.model.value)) ? "PARTIAL" : available > 0 ? "READY" : "NO_DATA";
  if (normalizedState === "NO_DATA") return { ...report, status: "NO_DATA", vehicle, provider: { ...report.provider, completedAt: now }, updatedAt: now };
  return enrichReport({ ...report, status: normalizedState, vehicle, provider: { ...report.provider, completedAt: now }, updatedAt: now });
}

export function createIVIHandler({ env = process.env, fetchImpl = fetch, repository = createIVIRepository(env, fetchImpl), provider = providerFrom(env, fetchImpl), now = () => new Date(), randomBytesImpl = randomBytes } = {}) {
  return async function handler(request) {
    const action = actionFor(request);
    if (!repository) return json({ success: false, error: "not_configured", message: ERROR_MESSAGES.not_configured }, 503);
    try {
      if (action === "analyze") {
        if (request.method !== "POST") return json({ success: false, error: "method_not_allowed", message: ERROR_MESSAGES.method_not_allowed }, 405);
        if (env.IVI_ANALYSIS_ENABLED !== "true") return json({ success: false, error: "not_configured", message: ERROR_MESSAGES.not_configured }, 503);
        const validation = validateAnalysisInput(await readJson(request));
        if (!validation.valid) return json({ success: false, error: "invalid_input", message: ERROR_MESSAGES.invalid_input, fields: validation.errors }, 422);
        const createdAt = now().toISOString();
        const id = reportId(now(), randomBytesImpl);
        const accessToken = createAccessToken();
        const secret = env.IVI_CALLBACK_SECRET || "";
        if (secret.length < 32) return json({ success: false, error: "not_configured", message: ERROR_MESSAGES.not_configured }, 503);
        const cbToken = callbackToken(id, secret);
        let report = {
          schemaVersion: 1, id, status: "DRAFT", inputs: validation.value, vehicle: null, findings: [], missingInformation: [], sellerQuestions: [], registration: null, verdict: null,
          provider: { id: "ONE_AUTO", product: "OE_BUILD_SHEET_EUROPE", sandbox: provider.sandbox, state: "pending", requestId: null, latencyMs: null },
          pdf: { status: "available_when_ready", generatedAt: null },
          accessTokenHash: hashToken(accessToken), callbackTokenHash: hashToken(cbToken), createdAt, updatedAt: createdAt,
        };
        await repository.putReport(report);
        await safeIncrement(repository, "reports_created");
        let result;
        let identityResult = null;
        try {
          const identityLookup = typeof provider.lookupIdentity === "function" ? provider.lookupIdentity(validation.value.vin) : Promise.resolve(null);
          const [buildOutcome, identityOutcome] = await Promise.allSettled([
            provider.lookupBuildSheet(validation.value.vin, { callbackUrl: callbackUrlFor(env, id, cbToken) }),
            identityLookup,
          ]);
          if (identityOutcome.status === "fulfilled" && ["READY", "PARTIAL"].includes(identityOutcome.value?.state)) identityResult = identityOutcome.value;
          if (buildOutcome.status === "rejected") throw buildOutcome.reason;
          result = buildOutcome.value;
          if (result.payload || identityResult?.payload) {
            await repository.putRaw(id, {
              provider: "ONE_AUTO", retrievedAt: now().toISOString(),
              buildSheet: result.payload ? { payload: result.payload, state: result.state } : null,
              vinDecoder: identityResult?.payload ? { payload: identityResult.payload, state: identityResult.state } : null,
            });
          }
          const updatedAt = now().toISOString();
          report = { ...report, provider: { ...report.provider, state: result.state.toLowerCase(), requestId: result.requestId || null, latencyMs: result.latencyMs, httpStatus: result.httpStatus, identity: identityResult ? { state: identityResult.state.toLowerCase(), latencyMs: identityResult.latencyMs, httpStatus: identityResult.httpStatus } : { state: "unavailable" } }, updatedAt };
          if (["READY", "PARTIAL"].includes(result.state)) report = completedReport(report, result.payload, result.state, updatedAt, identityResult?.payload);
          else if (result.state === "NO_DATA" && identityResult?.payload) report = completedReport(report, {}, "PARTIAL", updatedAt, identityResult.payload);
          else {
            report.status = result.state;
            if (identityResult?.payload) report.vehicle = normalizeOneAutoResponse({}, { vin: report.inputs.vin, retrievedAt: updatedAt, identityPayload: identityResult.payload });
          }
          await repository.putReport(report);
          await safeIncrement(repository, result.state === "READY" ? "provider_success" : `provider_${result.state.toLowerCase()}`);
        } catch (error) {
          const code = error instanceof OneAutoError ? error.code : "provider_failed";
          const updatedAt = now().toISOString();
          if (identityResult?.payload) {
            report = completedReport({ ...report, provider: { ...report.provider, state: "failed", error: code, identity: { state: identityResult.state.toLowerCase(), latencyMs: identityResult.latencyMs, httpStatus: identityResult.httpStatus } } }, {}, "PARTIAL", updatedAt, identityResult.payload);
          } else {
            report = { ...report, status: "FAILED", provider: { ...report.provider, state: "failed", error: code }, updatedAt };
          }
          await repository.putReport(report);
          await safeIncrement(repository, "provider_failures");
          console.warn(JSON.stringify({ event: "ivi_provider_failed", reportId: id, code, status: error?.status || null }));
        }
        return json({ success: true, report: publicReport(report), accessToken }, report.status === "PROCESSING" ? 202 : 200);
      }

      if (action === "report") {
        if (request.method !== "GET") return json({ success: false, error: "method_not_allowed", message: ERROR_MESSAGES.method_not_allowed }, 405);
        const id = new URL(request.url).searchParams.get("id") || "";
        const report = /^IVI-\d{4}-[A-F0-9]{8}$/.test(id) ? await repository.getReport(id) : null;
        if (!report) return json({ success: false, error: "report_not_found", message: ERROR_MESSAGES.report_not_found }, 404);
        if (!reportAccess(report, request)) return json({ success: false, error: "unauthorized", message: ERROR_MESSAGES.unauthorized }, 401);
        return json({ success: true, report: publicReport(report) });
      }

      if (action === "pdf") {
        if (request.method !== "GET") return json({ success: false, error: "method_not_allowed", message: ERROR_MESSAGES.method_not_allowed }, 405);
        const id = new URL(request.url).searchParams.get("id") || "";
        const report = await repository.getReport(id);
        if (!report) return json({ success: false, error: "report_not_found", message: ERROR_MESSAGES.report_not_found }, 404);
        if (!reportAccess(report, request)) return json({ success: false, error: "unauthorized", message: ERROR_MESSAGES.unauthorized }, 401);
        if (!["READY", "PARTIAL"].includes(report.status)) return json({ success: false, error: "report_not_ready", message: ERROR_MESSAGES.report_not_ready }, 409);
        const pdf = generateIVIPdf(publicReport(report));
        await safeIncrement(repository, "pdf_generated");
        return new Response(pdf, { status: 200, headers: { ...secureHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report.id}-IVI-Vehicle-Report.pdf"`, "Content-Length": String(pdf.length) } });
      }

      if (action === "webhook") {
        if (request.method !== "POST") return json({ success: false, error: "method_not_allowed", message: ERROR_MESSAGES.method_not_allowed }, 405);
        const url = new URL(request.url);
        const id = url.searchParams.get("reportId") || "";
        const report = await repository.getReport(id);
        if (!report || !verifyToken(url.searchParams.get("token"), report.callbackTokenHash)) return json({ success: false, error: "unauthorized", message: ERROR_MESSAGES.unauthorized }, 401);
        const payload = await readJson(request);
        const existingRaw = typeof repository.getRaw === "function" ? await repository.getRaw(id) : null;
        await repository.putRaw(id, { provider: "ONE_AUTO", retrievedAt: now().toISOString(), buildSheet: { payload, state: payload?.success === false ? "FAILED" : "READY" }, vinDecoder: existingRaw?.vinDecoder || null });
        const status = payload?.success === false ? "FAILED" : "READY";
        const updated = status === "READY" ? completedReport(report, payload, "READY", now().toISOString(), existingRaw?.vinDecoder?.payload) : { ...report, status: "FAILED", provider: { ...report.provider, state: "failed", completedAt: now().toISOString() }, updatedAt: now().toISOString() };
        await repository.putReport(updated);
        await safeIncrement(repository, status === "READY" ? "provider_callbacks" : "provider_failures");
        return json({ success: true });
      }
      return json({ success: false, error: "report_not_found", message: ERROR_MESSAGES.report_not_found }, 404);
    } catch (error) {
      const code = error?.code || "internal_error";
      const status = error?.status || 500;
      if (status >= 500) console.error(JSON.stringify({ event: "ivi_api_failed", action, code }));
      return json({ success: false, error: code, message: ERROR_MESSAGES[code] || "No hemos podido completar la solicitud." }, status);
    }
  };
}

const webHandler = createIVIHandler();

async function nodeRequestToWeb(request) {
  const headers = new Headers();
  Object.entries(request.headers || {}).forEach(([key, value]) => { if (Array.isArray(value)) value.forEach((item) => headers.append(key, item)); else if (value !== undefined) headers.set(key, String(value)); });
  let body = request.body;
  if (body && typeof body === "object" && !(body instanceof Uint8Array)) body = JSON.stringify(body);
  if (body === undefined && request.method !== "GET" && request.method !== "HEAD") { const chunks = []; for await (const chunk of request) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk); body = Buffer.concat(chunks); }
  const host = headers.get("host") || "ivanimports.es";
  const protocol = headers.get("x-forwarded-proto") || "https";
  return new Request(new URL(request.url || "/api/ivi", `${protocol}://${host}`), { method: request.method || "GET", headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : body });
}

async function sendNodeResponse(response, result) {
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

export default async function iviHandler(request, response) {
  if (request instanceof Request) return webHandler(request);
  return sendNodeResponse(response, await webHandler(await nodeRequestToWeb(request)));
}
