import test from "node:test";
import assert from "node:assert/strict";
import { OneAutoError, OneAutoProvider } from "../api/_ivi/one-auto.js";

test("OneAutoProvider usa sandbox, VIN, callback y x-api-key solo en servidor", async () => {
  let captured;
  const provider = new OneAutoProvider({ apiKey: "server-placeholder", sandbox: true, fetchImpl: async (url, options) => { captured = { url: String(url), options }; return Response.json({ success: true, result: {} }); } });
  const result = await provider.lookupBuildSheet("WVWZZZ1JZXW000001", { callbackUrl: "https://preview.example.com/api/ivi/webhook?token=opaque" });
  assert.equal(new URL(captured.url).hostname, "sandbox.oneautoapi.com");
  assert.equal(new URL(captured.url).searchParams.get("vehicle_identification_number"), "WVWZZZ1JZXW000001");
  assert.equal(new URL(captured.url).searchParams.get("return_data_in_callback"), "true");
  assert.equal(captured.options.headers["x-api-key"], "server-placeholder");
  assert.equal(result.state, "READY");
});

test("OneAutoProvider representa 202, 204 y 206 sin confundir estados", async () => {
  for (const [status, state] of [[202, "PROCESSING"], [204, "NO_DATA"], [206, "PARTIAL"]]) {
    const provider = new OneAutoProvider({ apiKey: "key", fetchImpl: async () => new Response(status === 204 ? null : JSON.stringify({ success: true, request_id: "request-1" }), { status, headers: { "content-type": "application/json" } }) });
    assert.equal((await provider.lookupBuildSheet("WVWZZZ1JZXW000001")).state, state);
  }
});

test("OneAutoProvider consulta el VIN Decoder oficial para identificar el vehículo", async () => {
  let capturedUrl;
  const provider = new OneAutoProvider({ apiKey: "key", sandbox: false, fetchImpl: async (url) => { capturedUrl = new URL(url); return Response.json({ success: true, result: {} }); } });
  const result = await provider.lookupIdentity("WVWZZZ1JZXW000001");
  assert.equal(capturedUrl.origin, "https://api.oneautoapi.com");
  assert.equal(capturedUrl.pathname, "/cartell/vindecoder");
  assert.equal(capturedUrl.searchParams.get("vehicle_identification_number"), "WVWZZZ1JZXW000001");
  assert.equal(result.state, "READY");
});

test("OneAutoProvider traduce límites y credenciales a errores estables", async () => {
  for (const [status, code] of [[403, "provider_forbidden"], [429, "provider_rate_limited"], [503, "provider_unavailable"]]) {
    const provider = new OneAutoProvider({ apiKey: "key", fetchImpl: async () => new Response("{}", { status, headers: { "content-type": "application/json" } }) });
    await assert.rejects(() => provider.lookupBuildSheet("WVWZZZ1JZXW000001"), (error) => error instanceof OneAutoError && error.code === code);
  }
});
