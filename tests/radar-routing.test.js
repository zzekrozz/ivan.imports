import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const vercel = JSON.parse(read("vercel.json"));
const rw = new Map(vercel.rewrites.map((r) => [r.source, r.destination]));

test("Radar usa una única función y rutas estables que sobreviven a la recarga", () => {
  assert.ok(vercel.functions["api/radar.js"]);
  assert.equal(rw.get("/radar/admin/"), "/api/radar?action=admin-page");
  assert.equal(rw.get("/api/radar/:action"), "/api/radar?action=:action");
  assert.equal(rw.get("/radar/coche/:slug/"), "/radar/coche/");
});

test("el administrador no está enlazado ni indexado", () => {
  assert.match(read("robots.txt"), /Disallow: \/radar\/admin\//);
  assert.doesNotMatch(read("sitemap.xml"), /radar\/admin/);
  for (const page of ["index.html", "radar/index.html", "radar/coche/index.html"]) assert.doesNotMatch(read(page), /radar\/admin/);
  assert.ok(vercel.headers.some((h) => h.source.startsWith("/radar/admin")));
});

test("la configuración documentada no contiene secretos reales", () => {
  const env = read(".env.example");
  for (const name of ["RADAR_GOOGLE_CLIENT_ID", "RADAR_ADMIN_GOOGLE_SUBS", "RADAR_SESSION_SECRET"]) assert.match(env, new RegExp(`^${name}=$`, "m"));
});
