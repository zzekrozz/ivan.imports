import { randomUUID } from "node:crypto";
import { isActive, isHistorical, lockedCount, projectForViewer } from "./_radar/access.js";
import { EXT, IMAGE_LIMIT, createBlobStore, imagePath, sniffImage } from "./_radar/blob.js";
import { makeSlug, normalizeTemplate, normalizeVehicleInput, publishErrors, summarize, validId } from "./_radar/vehicle.js";
import { costSummary } from "../assets/radar/cost-model.js";
import { createRadarRepository } from "./_radar/repository.js";
import { adminShell } from "./_radar/shell.js";
import {
  AuthError, buildCookie, constantTimeEqual, hmac, isAuthorizedSub, missingConfig, nonceCookieName, originAllowed,
  parseCookies, radarConfigFromEnv, randomToken, sessionCookieName, setupMode, verifyGoogleIdToken,
} from "./_radar/security.js";

const BODY_LIMIT = 8 * 1024;
const NONCE_TTL = 300;

function baseHeaders(extra = {}) {
  return { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow, noarchive", ...extra };
}
const json = (body, status = 200, extra = {}, cookies = []) => {
  const headers = new Headers(baseHeaders(extra));
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return Response.json(body, { status, headers });
};
const requestIp = (request) => String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 64);
const log = (event, data = {}) => console.warn(JSON.stringify({ scope: "radar", event, ...data }));

export const resolveRadarAction = (request) => new URL(request.url).searchParams.get("action") || "";

export const LOGIN_HEADERS = { "Referrer-Policy": "strict-origin-when-cross-origin", "Cross-Origin-Opener-Policy": "same-origin-allow-popups" };
const PUBLIC_CACHE = { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=30" };
/** Un análisis PRO abierto puede cerrarse en cualquier momento (por fecha o porque Iván lo cierra): nunca se guarda en la CDN. */
export const publicCacheHeaders = (views) => (views.some((view) => view?.tier === "open") ? {} : PUBLIC_CACHE);

const ADMIN_CSP = "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; img-src 'self' data: https:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

export function createRadarHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now(), repository, blobStore } = {}) {
  const config = radarConfigFromEnv(env);
  const missing = missingConfig(config);
  const setup = setupMode(config);
  const repo = repository || (config.redisUrl && config.redisToken ? createRadarRepository(config, fetchImpl) : null);
  const blob = blobStore || createBlobStore(env);
  const cookieName = sessionCookieName(config.vercelEnv);
  const nonceName = nonceCookieName(config.vercelEnv);

  async function sessionFrom(request) {
    if (!repo || missing.length) return null;
    const id = parseCookies(request.headers.get("cookie"))[cookieName];
    const session = await repo.readSession(id);
    if (!session) return null;
    if (!isAuthorizedSub(session.sub, config)) { await repo.deleteSession(id); return null; }
    return { ...session, id };
  }

  /** Toda operación administrativa pasa por aquí: sesión válida + (si modifica) origen y token CSRF. */
  async function requireAdmin(request, { mutating = false } = {}) {
    if (missing.length) throw new AuthError("not_configured", 503);
    if (setup) throw new AuthError("setup_mode", 503);
    const session = await sessionFrom(request);
    if (!session) throw new AuthError("unauthorized", 401);
    if (mutating) {
      if (!originAllowed(request, config)) throw new AuthError("bad_origin", 403);
      const csrf = request.headers.get("x-radar-csrf") || "";
      if (!csrf || !constantTimeEqual(csrf, session.csrf)) throw new AuthError("bad_csrf", 403);
    }
    return session;
  }

  async function rateLimit(request, bucket, max, windowSeconds) {
    if ((await repo.hit(`${bucket}:${requestIp(request)}`, windowSeconds)) > max) throw Object.assign(new AuthError("rate_limited", 429), { retryAfter: windowSeconds });
  }

  async function readJson(request) {
    if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new AuthError("bad_content_type", 415);
    const text = await request.text();
    if (text.length > BODY_LIMIT) throw new AuthError("too_large", 413);
    try { return JSON.parse(text); } catch { throw new AuthError("bad_json", 400); }
  }


  const enrich = (vehicle) => (vehicle.costs ? { ...vehicle, costSummary: costSummary({ price: vehicle.price, costs: vehicle.costs, reference: vehicle.spainReference }) } : vehicle);
  const publicView = (vehicle) => projectForViewer(enrich(vehicle), "free", now());
  const fail = (status, reason, extra = {}) => json({ error: reason, ...extra }, status);
  const summary = (v) => ({ id: v.id, slug: v.slug, brand: v.brand, model: v.model, year: v.year, price: v.price, country: v.country, editorialStatus: v.editorialStatus, listingStatus: v.listingStatus, published: v.published, accessMode: v.accessMode, updatedAt: v.updatedAt, version: v.version, cover: v.images?.[0]?.url || null });

  async function saveAction(request) {
    const body = await readJson(request);
    const { value, errors } = normalizeVehicleInput(body.data, { currentYear: new Date(now()).getFullYear() });
    if (errors.length) return fail(422, "validation", { errors });
    const stamp = new Date(now()).toISOString();
    if (!body.id) {
      if (!(value.brand || value.model || value.originalUrl)) return fail(422, "validation", { errors: [{ field: "brand", message: "Indica al menos marca, modelo o enlace" }] });
      const id = validId(body.clientId) ? body.clientId : randomUUID();
      const record = { id, schemaVersion: 1, version: 1, createdAt: stamp, updatedAt: stamp, published: false, publishedAt: null, editorialStatus: "draft", listingStatus: "available", accessMode: "pro", currency: "EUR", ...value };
      record.slug = makeSlug(record);
      const result = await repo.createVehicle(record);
      await repo.audit({ type: "vehicle_create", id });
      return json({ vehicle: result.record, created: result.created }, result.created ? 201 : 200);
    }
    if (!validId(body.id)) return fail(400, "bad_id");
    const current = await repo.getVehicle(body.id);
    if (!current) return fail(404, "not_found");
    if (Number(body.expectedVersion) !== current.version) return fail(409, "version_conflict", { currentVersion: current.version });
    const next = { ...current, ...value, id: current.id, slug: current.slug, createdAt: current.createdAt, published: current.published, publishedAt: current.publishedAt, version: current.version + 1, updatedAt: stamp };
    if (current.published) { const errors2 = publishErrors(next); if (errors2.length) return fail(422, "validation", { errors: errors2 }); }
    if (!(await repo.saveVehicle(next, current.version, current))) return fail(409, "version_conflict");
    await repo.audit({ type: "vehicle_save", id: next.id, version: next.version });
    return json({ vehicle: next });
  }

  async function transition(request, apply) {
    const body = await readJson(request);
    if (!validId(body.id)) return fail(400, "bad_id");
    const current = await repo.getVehicle(body.id);
    if (!current) return fail(404, "not_found");
    if (Number(body.expectedVersion) !== current.version) return fail(409, "version_conflict", { currentVersion: current.version });
    const outcome = apply(current, body);
    if (outcome.errors) return fail(422, "validation", { errors: outcome.errors });
    const next = { ...current, ...outcome.patch, version: current.version + 1, updatedAt: new Date(now()).toISOString() };
    if (!(await repo.saveVehicle(next, current.version, current))) return fail(409, "version_conflict");
    await repo.audit({ type: outcome.event, id: next.id, version: next.version });
    return json({ vehicle: next });
  }

  async function imageUpload(request) {
    if (!blob.configured) return fail(503, "blob_not_configured");
    await rateLimit(request, "upload", 60, 600);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > IMAGE_LIMIT) return fail(413, "too_large");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > IMAGE_LIMIT) return fail(413, "too_large");
    const type = sniffImage(bytes);
    if (!type) return fail(415, "unsupported_image");
    const vehicleId = new URL(request.url).searchParams.get("vehicleId") || "";
    const folder = validId(vehicleId) ? vehicleId : "sin-asignar";
    const out = await blob.put(imagePath(config.environment, folder, EXT[type]), Buffer.from(bytes), type);
    return json({ url: out.url, type, bytes: bytes.length }, 201);
  }

  async function adminPage(request) {
    const headers = baseHeaders({ "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": ADMIN_CSP });
    if (missing.length) return new Response(adminShell({ state: "unconfigured", missing }), { status: 503, headers });
    const session = setup ? null : await sessionFrom(request);
    if (session) return new Response(adminShell({ state: "panel", csrf: session.csrf }), { status: 200, headers });
    // Google Identity Services valida el origen con el Referer del iframe y abre un popup: no-referrer lo rompe.
    return new Response(adminShell({ state: "login", clientId: config.clientId, setup }), { status: 200, headers: { ...headers, ...LOGIN_HEADERS } });
  }

  async function adminNonce(request) {
    if (missing.length) throw new AuthError("not_configured", 503);
    await rateLimit(request, "nonce", 30, 600);
    const nonce = randomToken(18);
    return json({ nonce }, 200, {}, [buildCookie(nonceName, `${nonce}.${hmac(config.sessionSecret, `nonce:${nonce}`)}`, { vercelEnv: config.vercelEnv, maxAge: NONCE_TTL })]);
  }

  async function adminLogin(request) {
    if (missing.length) throw new AuthError("not_configured", 503);
    if (!originAllowed(request, config)) throw new AuthError("bad_origin", 403);
    await rateLimit(request, "login", 10, 600);
    const body = await readJson(request);
    const [nonce, mac] = String(parseCookies(request.headers.get("cookie"))[nonceName] || "").split(".");
    if (!nonce || !mac || !constantTimeEqual(mac, hmac(config.sessionSecret, `nonce:${nonce}`))) throw new AuthError("bad_nonce", 401);
    const identity = await verifyGoogleIdToken(body?.credential, { clientId: config.clientId, nonce, fetchImpl, now: now() });
    if (!(await repo.consumeNonce(nonce))) throw new AuthError("nonce_reused", 401);
    if (setup) return json({ setup: true, sub: identity.sub }); // solo se muestra a quien acaba de autenticarse; no se guarda ni se registra
    if (!isAuthorizedSub(identity.sub, config)) {
      log("admin_denied"); // sin identificadores personales en los registros
      throw new AuthError("forbidden", 403);
    }
    const session = await repo.createSession({ sub: identity.sub });
    await repo.audit({ type: "admin_login", sub: identity.sub });
    return json({ ok: true, csrf: session.csrf }, 200, {}, [
      buildCookie(cookieName, session.id, { vercelEnv: config.vercelEnv, maxAge: config.sessionTtl }),
      buildCookie(nonceName, "", { vercelEnv: config.vercelEnv, maxAge: 0 }),
    ]);
  }

  return async function handler(request) {
    const action = resolveRadarAction(request);
    const method = request.method.toUpperCase();
    try {
      if (action === "admin-page" && method === "GET") return await adminPage(request);
      if (action === "admin-nonce" && method === "GET") return await adminNonce(request);
      if (action === "admin-login" && method === "POST") return await adminLogin(request);
      if (action === "admin-session" && method === "GET") {
        const session = await sessionFrom(request);
        return json(session ? { authenticated: true, csrf: session.csrf } : { authenticated: false });
      }
      if (action === "admin-stats" && method === "GET") {
        await requireAdmin(request);
        return json({ counts: summarize(await repo.listVehicles(), now()), source: "redis", generatedAt: new Date(now()).toISOString() });
      }
      if (action === "admin-logout" && method === "POST") {
        const session = await requireAdmin(request, { mutating: true });
        await repo.deleteSession(session.id);
        return json({ ok: true }, 200, {}, [buildCookie(cookieName, "", { vercelEnv: config.vercelEnv, maxAge: 0 })]);
      }
      if (action === "admin-vehicles" && method === "GET") {
        await requireAdmin(request);
        const all = (await repo.listVehicles()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        return json({ vehicles: all.map(summary), counts: summarize(all, now()) });
      }
      if (action === "admin-vehicle" && method === "GET") {
        await requireAdmin(request);
        const id = new URL(request.url).searchParams.get("id");
        const vehicle = validId(id) ? await repo.getVehicle(id) : null;
        return vehicle ? json({ vehicle: enrich(vehicle) }) : fail(404, "not_found");
      }
      if (action === "admin-save" && method === "POST") { await requireAdmin(request, { mutating: true }); return await saveAction(request); }
      if (action === "admin-publish" && method === "POST") {
        await requireAdmin(request, { mutating: true });
        return transition(request, (v) => { const errors = publishErrors(v); return errors.length ? { errors } : { patch: { published: true, publishedAt: v.publishedAt || new Date(now()).toISOString() }, event: "vehicle_publish" }; });
      }
      if (action === "admin-unpublish" && method === "POST") { await requireAdmin(request, { mutating: true }); return transition(request, () => ({ patch: { published: false }, event: "vehicle_unpublish" })); }
      if (action === "admin-listing" && method === "POST") {
        await requireAdmin(request, { mutating: true });
        return transition(request, (v, body) => (["available", "pending", "withdrawn", "sold", "archived"].includes(body.listingStatus) ? { patch: { listingStatus: body.listingStatus }, event: "vehicle_listing" } : { errors: [{ field: "listingStatus", message: "Estado no permitido" }] }));
      }
      if (action === "admin-delete" && method === "POST") {
        await requireAdmin(request, { mutating: true });
        const body = await readJson(request);
        const vehicle = validId(body.id) ? await repo.getVehicle(body.id) : null;
        if (!vehicle) return fail(404, "not_found");
        if (vehicle.published) return fail(409, "unpublish_first");
        await repo.deleteVehicle(vehicle);
        await repo.audit({ type: "vehicle_delete", id: vehicle.id });
        return json({ ok: true });
      }
      if (action === "admin-image" && method === "POST") { await requireAdmin(request, { mutating: true }); return await imageUpload(request); }
      if (action === "admin-templates" && method === "GET") { await requireAdmin(request); return json({ templates: await repo.listTemplates() }); }
      if (action === "admin-template-save" && method === "POST") {
        await requireAdmin(request, { mutating: true });
        const body = await readJson(request);
        const t = normalizeTemplate(body);
        if (t.errors.length) return fail(422, "validation", { errors: t.errors });
        const id = validId(body.id) ? body.id : randomUUID();
        const template = { id, name: t.name, mode: t.mode, items: t.items, updatedAt: new Date(now()).toISOString() };
        await repo.saveTemplate(template);
        return json({ template });
      }
      if (action === "admin-template-delete" && method === "POST") {
        await requireAdmin(request, { mutating: true });
        const body = await readJson(request);
        if (!validId(body.id)) return fail(400, "bad_id");
        await repo.deleteTemplate(body.id);
        return json({ ok: true });
      }
      if (action === "vehicles" && method === "GET") {
        if (!repo) return json({ vehicles: [], locked: 0, configured: false });
        const all = await repo.getVehicles(await repo.publishedIds());
        const archive = new URL(request.url).searchParams.get("archive") === "1";
        const list = all.filter((vehicle) => (archive ? isHistorical(vehicle) : isActive(vehicle))).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
        const visible = list.map(publicView).filter(Boolean);
        return json({ vehicles: visible, locked: archive ? 0 : lockedCount(all, "free", now()), configured: true }, 200, publicCacheHeaders(visible));
      }
      if (action === "vehicle" && method === "GET") {
        if (!repo) return fail(404, "not_found");
        const slug = new URL(request.url).searchParams.get("slug") || "";
        const vehicle = /^[a-z0-9-]{3,100}$/.test(slug) ? await repo.vehicleBySlug(slug) : null;
        const view = vehicle ? publicView(vehicle) : null;
        return view ? json({ vehicle: view }, 200, publicCacheHeaders([view])) : fail(404, "not_found");
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const status = Number(error?.status) || 503;
      if (status >= 500) log("api_error", { action, reason: String(error?.message || error).slice(0, 80) });
      const code = error instanceof AuthError ? error.reason : status === 429 ? "rate_limited" : "service_unavailable";
      const extra = error?.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
      return json({ error: code }, status, extra);
    }
  };
}

const handler = createRadarHandler();
export default { fetch: (request) => handler(request) };
