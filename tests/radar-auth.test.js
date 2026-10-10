import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_SUB, BASE, setup, makeGoogle } from "./radar-helpers.js";

const sessionCookie = (r, ctx) => ctx.cookieOf(r, "__Host-radar_admin").split(";")[0];

test("sin sesión no se accede a datos de administración ni al panel", async () => {
  const ctx = setup();
  assert.equal((await ctx.call("admin-stats")).status, 401);
  const page = await ctx.call("admin-page");
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /gsi\/client/);
  assert.doesNotMatch(html, /data-k=/);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
});

test("la página de login es compatible con Google Identity Services (Referer de origen, popup y CSP)", async () => {
  for (const env of [{}, { RADAR_ADMIN_GOOGLE_SUBS: "" }]) {
    const ctx = setup({ env });
    const page = await ctx.call("admin-page");
    const html = await page.text();
    assert.equal(page.headers.get("referrer-policy"), "strict-origin-when-cross-origin", "no-referrer impide a Google validar el origen");
    assert.equal(page.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
    assert.doesNotMatch(html, /content="no-referrer"/);
    assert.match(html, /data-client-id="test-client.apps.googleusercontent.com"/);
    const csp = page.headers.get("content-security-policy");
    for (const directive of ["script-src 'self' https://accounts.google.com/gsi/", "frame-src https://accounts.google.com/gsi/", "connect-src 'self' https://accounts.google.com/gsi/", "https://accounts.google.com/gsi/style"]) assert.ok(csp.includes(directive), directive);
    assert.equal((await ctx.call("admin-nonce")).status, 200, "el alta inicial puede pedir nonce");
  }
  const ctx = setup();
  const { r } = await ctx.login();
  const cookie = ctx.cookieOf(r, "__Host-radar_admin").split(";")[0];
  const panel = await ctx.call("admin-page", { cookie });
  assert.equal(panel.headers.get("referrer-policy"), "no-referrer", "el panel conserva no-referrer");
});

test("sin configuración el panel está cerrado y solo muestra nombres de variables", async () => {
  const ctx = setup({ env: { RADAR_SESSION_SECRET: "" } });
  const page = await ctx.call("admin-page");
  const html = await page.text();
  assert.equal(page.status, 503);
  assert.match(html, /RADAR_SESSION_SECRET/);
  assert.equal((await ctx.call("admin-stats")).status, 503);
  assert.equal((await ctx.call("admin-nonce")).status, 503);
});

test("la cuenta autorizada entra, con cookie HttpOnly/Secure/Strict, y cierra sesión con CSRF", async () => {
  const ctx = setup();
  const { r } = await ctx.login();
  assert.equal(r.status, 200);
  const raw = ctx.cookieOf(r, "__Host-radar_admin");
  assert.match(raw, /HttpOnly/); assert.match(raw, /Secure/); assert.match(raw, /SameSite=Strict/); assert.match(raw, /Path=\//);
  assert.doesNotMatch(raw, /Domain=/);
  const cookie = sessionCookie(r, ctx);
  const { csrf } = await r.json();
  const stats = await ctx.call("admin-stats", { cookie });
  assert.equal(stats.status, 200);
  const body = await stats.json();
  assert.equal(body.counts.published, 0); assert.equal(body.counts.draft, 0);
  assert.equal((await ctx.call("admin-logout", { method: "POST", cookie })).status, 403, "sin CSRF no cierra");
  assert.equal((await ctx.call("admin-logout", { method: "POST", cookie, headers: { "x-radar-csrf": "falso" } })).status, 403);
  assert.equal((await ctx.call("admin-logout", { method: "POST", cookie, origin: "https://evil.example", headers: { "x-radar-csrf": csrf } })).status, 403, "origen ajeno");
  assert.equal((await ctx.call("admin-logout", { method: "POST", cookie, headers: { "x-radar-csrf": csrf } })).status, 200);
  assert.equal((await ctx.call("admin-stats", { cookie })).status, 401, "la sesión ya no vale");
});

test("otra cuenta de Google es denegada y no recibe sesión", async () => {
  const ctx = setup();
  const { r } = await ctx.login({ sub: "999999999999" });
  assert.equal(r.status, 403);
  assert.equal(ctx.cookieOf(r, "__Host-radar_admin"), undefined);
});

test("tokens inválidos se rechazan: audiencia, emisor, caducado, firma ajena, alg none/HS256, correo sin verificar", async () => {
  const cases = [
    [{ aud: "otro-cliente" }, {}], [{ iss: "https://evil.example" }, {}], [{ exp: Math.floor(Date.now() / 1000) - 3600 }, {}],
    [{}, { key: makeGoogle().otherKey }], [{}, { alg: "none", signIt: false }], [{}, { alg: "HS256" }], [{ email_verified: false }, {}], [{}, { kid: "desconocida" }],
  ];
  for (const [claims, opts] of cases) {
    const ctx = setup();
    const { r } = await ctx.login(claims, opts);
    assert.equal(r.status, 401, JSON.stringify([claims, opts]));
    assert.equal(ctx.cookieOf(r, "__Host-radar_admin"), undefined);
  }
});

test("el nonce debe coincidir y solo se canjea una vez", async () => {
  const ctx = setup();
  const n = await ctx.call("admin-nonce");
  const { nonce } = await n.json();
  const nonceCookie = ctx.cookieOf(n, "__Host-radar_nonce").split(";")[0];
  const bad = await ctx.call("admin-login", { method: "POST", cookie: nonceCookie, body: { credential: ctx.google.token({ nonce: "otro" }) } });
  assert.equal(bad.status, 401);
  const credential = ctx.google.token({ nonce });
  assert.equal((await ctx.call("admin-login", { method: "POST", cookie: nonceCookie, body: { credential } })).status, 200);
  assert.equal((await ctx.call("admin-login", { method: "POST", cookie: nonceCookie, body: { credential } })).status, 401, "repetición");
  const sin = await ctx.call("admin-login", { method: "POST", body: { credential } });
  assert.equal(sin.status, 401, "sin cookie de nonce");
});

test("el login exige origen propio, JSON y tamaño razonable", async () => {
  const ctx = setup();
  const n = await ctx.call("admin-nonce");
  const { nonce } = await n.json();
  const c = ctx.cookieOf(n, "__Host-radar_nonce").split(";")[0];
  const credential = ctx.google.token({ nonce });
  assert.equal((await ctx.call("admin-login", { method: "POST", cookie: c, origin: "https://evil.example", body: { credential } })).status, 403);
  assert.equal((await ctx.call("admin-login", { method: "POST", cookie: c, origin: null, body: { credential } })).status, 403);
  assert.equal((await ctx.call("admin-login", { method: "POST", cookie: c, body: { credential: "a".repeat(5000) } })).status, 401);
});

test("cookies falsificadas o sesiones de una cuenta retirada no valen", async () => {
  const ctx = setup();
  assert.equal((await ctx.call("admin-stats", { cookie: `__Host-radar_admin=${"a".repeat(43)}` })).status, 401);
  assert.equal((await ctx.call("admin-stats", { cookie: "__Host-radar_admin=corta" })).status, 401);
  const { r } = await ctx.login();
  const cookie = sessionCookie(r, ctx);
  assert.equal((await ctx.call("admin-stats", { cookie })).status, 200);
  const revoked = setup({ env: { RADAR_ADMIN_GOOGLE_SUBS: "otra-persona" } });
  for (const [k, v] of ctx.redis.kv) revoked.redis.kv.set(k, v);
  assert.equal((await revoked.call("admin-stats", { cookie })).status, 401);
});

test("el login tiene límite de intentos", async () => {
  const ctx = setup();
  let last;
  for (let i = 0; i < 12; i += 1) last = (await ctx.call("admin-login", { method: "POST", body: { credential: "x" } })).status;
  assert.equal(last, 429);
});

test("todas las claves de Radar usan su namespace y no tocan otros productos", async () => {
  const ctx = setup();
  await ctx.login();
  assert.ok(ctx.redis.kv.size > 0);
  for (const key of ctx.redis.kv.keys()) assert.match(key, /^radar:v1:production:/);
});

test("alta inicial: sin administradores autorizados se muestra el sub propio, sin sesión y sin registrar el identificador", async () => {
  const logs = []; const original = console.warn; console.warn = (m) => logs.push(String(m));
  try {
    const ctx = setup({ env: { RADAR_ADMIN_GOOGLE_SUBS: "" } });
    const html = await (await ctx.call("admin-page")).text();
    assert.match(html, /Modo de alta inicial/);
    const { r } = await ctx.login({ sub: "424242424242" });
    assert.equal(r.status, 200);
    const out = await r.json();
    assert.equal(out.setup, true); assert.equal(out.sub, "424242424242");
    assert.equal(ctx.cookieOf(r, "__Host-radar_admin"), undefined, "no se crea sesión");
    assert.equal((await ctx.call("admin-stats")).status, 503, "ninguna operación administrativa en modo alta");
    assert.equal((await ctx.call("admin-stats", { cookie: "__Host-radar_admin=" + "a".repeat(43) })).status, 503);
    for (const key of ctx.redis.kv.keys()) assert.doesNotMatch(key + ctx.redis.kv.get(key), /424242424242/);
  } finally { console.warn = original; }
  assert.equal(logs.some((l) => /424242424242/.test(l)), false);
});

test("una cuenta denegada no deja su identificador en los registros", async () => {
  const logs = []; const original = console.warn; console.warn = (m) => logs.push(String(m));
  try { const ctx = setup(); const { r } = await ctx.login({ sub: "777000777000" }); assert.equal(r.status, 403); } finally { console.warn = original; }
  assert.equal(logs.some((l) => /777000777000/.test(l)), false);
});
