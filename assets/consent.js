(() => {
  const KEY = "ivanimports.consent.v1";
  const TTL = 180 * 24 * 60 * 60 * 1000;
  let saved = null;
  try {
    const record = JSON.parse(localStorage.getItem(KEY) || "null");
    if (record && record.version === 1 && typeof record.analytics === "boolean" && Number.isFinite(record.savedAt) && Date.now() - record.savedAt < TTL) saved = record;
  } catch { /* Sin almacenamiento disponible, se solicita consentimiento en cada visita. */ }
  let analytics = saved?.analytics === true;
  let loaded = false;
  const update = () => window.gtag?.("consent", "update", { analytics_storage: analytics ? "granted" : "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  function clearAnalyticsCookies() {
    for (const part of document.cookie.split(";")) {
      const name = part.trim().split("=")[0];
      if (!/^_(?:ga|gid|gat|gac|gcl)(?:_|$)/.test(name)) continue;
      const domains = ["", location.hostname, "." + location.hostname];
      const pieces = location.hostname.split(".");
      if (pieces.length > 2) domains.push("." + pieces.slice(-2).join("."));
      const paths = ["/", ...location.pathname.split("/").filter(Boolean).map((_, i, parts) => "/" + parts.slice(0, i + 1).join("/"))];
      for (const domain of domains) for (const path of paths) document.cookie = name + "=; Max-Age=0; path=" + path + (domain ? "; domain=" + domain : "") + "; SameSite=Lax";
    }
  }
  function loadAnalytics() {
    if (!analytics || loaded) return;
    loaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-PRKZJFTT";
    script.dataset.consentCategory = "analytics";
    document.head.append(script);
  }
  update();
  if (analytics) loadAnalytics(); else clearAnalyticsCookies();
  document.body.insertAdjacentHTML("beforeend", '<dialog class="ivan-consent" id="ivan-consent" aria-labelledby="ivan-consent-title"><h2 id="ivan-consent-title">Tu privacidad</h2><p>Utilizamos almacenamiento necesario para recordar tu elección. Solo activaremos Google Analytics si aceptas la categoría Analítica. Puedes cambiar tu decisión en cualquier momento. <a href="/cookies">Política de cookies</a>.</p><div class="ivan-consent-settings" hidden><label><input type="checkbox" checked disabled> Necesarias (siempre activas)</label><small>Permiten recordar tus preferencias y utilizar las funciones que solicites.</small><label><input type="checkbox" id="ivan-consent-analytics"> Analítica</label><small>Google Analytics, mediante Google Tag Manager, para conocer el uso de la web. Desactivada inicialmente.</small></div><div class="ivan-consent-actions"><button type="button" data-consent-choice="reject">RECHAZAR</button><button type="button" data-consent-choice="configure">CONFIGURAR</button><button type="button" data-consent-choice="accept">ACEPTAR</button><button type="button" data-consent-choice="save" hidden>GUARDAR PREFERENCIAS</button></div></dialog>');
  const dialog = document.querySelector("#ivan-consent");
  const settings = dialog.querySelector(".ivan-consent-settings");
  const checkbox = dialog.querySelector("#ivan-consent-analytics");
  const saveButton = dialog.querySelector('[data-consent-choice="save"]');
  function openSettings(configure = true) {
    checkbox.checked = analytics;
    settings.hidden = !configure;
    saveButton.hidden = !configure;
    document.body.classList.add("consent-ui-open");
    if (!dialog.open) dialog.showModal();
  }
  function choose(value) {
    analytics = value;
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, analytics, savedAt: Date.now() })); } catch { /* La elección sigue vigente para esta página. */ }
    update();
    if (analytics) loadAnalytics(); else clearAnalyticsCookies();
    dialog.close();
    document.body.classList.remove("consent-ui-open");
  }
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); choose(false); });
  dialog.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-consent-choice]")?.dataset.consentChoice;
    if (choice === "configure") openSettings(true);
    if (choice === "reject") choose(false);
    if (choice === "accept") choose(true);
    if (choice === "save") choose(checkbox.checked);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-consent-open]")) return;
    event.preventDefault();
    openSettings();
  });
  window.IVAN_CONSENT = Object.freeze({ getState: () => ({ necessary: true, analytics }), openSettings });
  if (!saved) openSettings(false);
})();
