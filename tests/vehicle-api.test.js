import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vehicleHandler, { createVehicleHandler } from "../api/vehicle.js";
import { Readable } from "node:stream";

const root = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(root, "fixtures/mobile-de/standard-diesel-auto.html"), "utf8");
const request = (body, contentType = "application/json") => new Request("https://ivanimports.es/api/vehicle/import", { method: "POST", headers: { "content-type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("API rechaza fuente no compatible sin hacer fetch", async () => {
  const handler = createVehicleHandler({ fetchImpl: async () => { throw new Error("no debe ejecutarse"); } });
  const response = await handler(request({ url: "https://example.com/car/1" }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "unsupported_source");
});

test("API importa y devuelve vehículo normalizado", async () => {
  const handler = createVehicleHandler({ fetchImpl: async () => new Response(html, { headers: { "content-type": "text/html" } }) });
  const response = await handler(request({ url: "https://www.mobile.de/fahrzeuge/details.html?id=459800097&utm_campaign=x" }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.vehicle.sourceListingId, "459800097");
  assert.equal(payload.vehicle.price, 12900);
});

test("API exige JSON y POST", async () => {
  const handler = createVehicleHandler();
  assert.equal((await handler(new Request("https://ivanimports.es/api/vehicle/import"))).status, 405);
  assert.equal((await handler(request("x", "text/plain"))).status, 415);
});

test("adaptador Vercel Node convierte request y response sin perder JSON", async () => {
  const requestBody = JSON.stringify({ url: "https://example.com/car/1" });
  const nodeRequest = Readable.from([requestBody]);
  Object.assign(nodeRequest, { method: "POST", url: "/api/vehicle/import", headers: { host: "ivanimports.es", "content-type": "application/json" } });
  const output = { headers: {}, body: null, statusCode: 0, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
  await vehicleHandler(nodeRequest, output);
  assert.equal(output.statusCode, 422);
  assert.equal(JSON.parse(output.body.toString()).error, "unsupported_source");
});
