export const ONE_AUTO_PROVIDER_ID = "ONE_AUTO";
const LIVE_BASE = "https://api.oneautoapi.com";
const SANDBOX_BASE = "https://sandbox.oneautoapi.com";

export class OneAutoError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "OneAutoError";
    this.code = code;
    this.status = status;
  }
}

export class OneAutoProvider {
  constructor({ apiKey, sandbox = true, callbackBaseUrl = null, timeoutMs = 20_000, fetchImpl = fetch } = {}) {
    this.id = ONE_AUTO_PROVIDER_ID;
    this.apiKey = apiKey;
    this.sandbox = Boolean(sandbox);
    this.callbackBaseUrl = callbackBaseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  configured() {
    return Boolean(this.apiKey);
  }

  async request(url) {
    if (!this.configured()) throw new OneAutoError("provider_not_configured", "One Auto API no está configurado.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    const startedAt = Date.now();
    try {
      response = await this.fetchImpl(url, { method: "GET", headers: { "x-api-key": this.apiKey, accept: "application/json" }, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new OneAutoError("provider_timeout", "One Auto API ha agotado el tiempo de espera.");
      throw new OneAutoError("provider_unavailable", "No se pudo contactar con One Auto API.");
    } finally {
      clearTimeout(timer);
    }
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    const base = { provider: this.id, latencyMs: Date.now() - startedAt, httpStatus: response.status, payload };
    if (response.status === 200) return { ...base, state: payload?.success === false ? "FAILED" : "READY" };
    if (response.status === 202) return { ...base, state: "PROCESSING", requestId: payload?.request_id || payload?.requestId || payload?.id || null };
    if (response.status === 204) return { ...base, state: "NO_DATA" };
    if (response.status === 206) return { ...base, state: "PARTIAL" };
    if (response.status === 400) throw new OneAutoError("provider_invalid_request", "One Auto API ha rechazado los parámetros.", response.status);
    if (response.status === 403) throw new OneAutoError("provider_forbidden", "La clave o el servicio One Auto no están habilitados.", response.status);
    if (response.status === 429) throw new OneAutoError("provider_rate_limited", "Se ha alcanzado el límite del proveedor.", response.status);
    if (response.status === 503) throw new OneAutoError("provider_unavailable", "One Auto API no está disponible temporalmente.", response.status);
    throw new OneAutoError("provider_failed", `One Auto API respondió ${response.status}.`, response.status);
  }

  async lookupBuildSheet(vin, { callbackUrl = null } = {}) {
    const url = new URL("/oneauto/oebuildsheeteuropefromvin", this.sandbox ? SANDBOX_BASE : LIVE_BASE);
    url.searchParams.set("vehicle_identification_number", vin);
    const callback = callbackUrl || this.callbackBaseUrl;
    if (callback) {
      url.searchParams.set("callback_url", callback);
      url.searchParams.set("return_data_in_callback", "true");
    }
    return this.request(url);
  }

  async lookupIdentity(vin) {
    const url = new URL("/cartell/vindecoder", this.sandbox ? SANDBOX_BASE : LIVE_BASE);
    url.searchParams.set("vehicle_identification_number", vin);
    return this.request(url);
  }
}
