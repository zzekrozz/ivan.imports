const CACHE_NAME = "mission-control-planning-v5";
const STATIC_ASSETS = [
  "/assets/control/app.css?v=5.0.0",
  "/assets/control/app.js?v=5.0.0",
  "/assets/control/domain.js",
  "/assets/control/mission-tree.js",
  "/assets/control/project-cockpit.js",
  "/assets/control/mission-schedule.js",
  "/assets/control/manifest.webmanifest",
  "/control/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/assets/control/") || url.pathname === "/control/icon.svg") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { title: "Mission Control", body: event.data?.text() || "Tienes una misión pendiente." }; }
  event.waitUntil(self.registration.showNotification(payload.title || "Mission Control", {
    body: payload.body || "Tienes una misión pendiente.",
    icon: "/control/icon.svg",
    badge: "/control/icon.svg",
    tag: payload.delivery_id || payload.quest_id || "mission-control-reminder",
    renotify: true,
    data: { url: payload.url || "/control/", quest_id: payload.quest_id || null, delivery_id: payload.delivery_id || null },
    actions: [{ action: "open", title: "Abrir misión" }],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/control/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).pathname.startsWith("/control"));
    if (existing) { await existing.focus(); return existing.navigate(target); }
    return self.clients.openWindow(target);
  }));
});
