(() => {
  "use strict";

  const trackEvent = (eventName, params = {}) => {
    if (!eventName) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...params });
  };

  const bindTrackedLink = (link) => {
    if (!link?.getAttribute("href") || !link.dataset.goTrack || link.dataset.goBound === "true") return;
    link.dataset.goBound = "true";
    link.addEventListener("click", () => {
      trackEvent(link.dataset.goTrack, {
        destination: link.href,
        placement: link.dataset.goPlacement || "hub",
      });
    });
  };

  const config = window.IVAN_IMPORTS_CONFIG || {};
  const promo = config.promoGo || {};
  const promoBadge = document.querySelector("[data-go-promo]");
  const promoCode = document.querySelector("[data-go-promo-code]");

  if (promoBadge && promo.active === true && String(promo.label || "").trim()) {
    promoBadge.textContent = String(promo.label).trim();
    promoBadge.hidden = false;
  }

  if (promoCode && promo.active === true && String(promo.code || "").trim()) {
    promoCode.textContent = `CÓDIGO: ${String(promo.code).trim()}`;
    promoCode.hidden = false;
  }

  document.querySelectorAll("[data-go-track]").forEach(bindTrackedLink);
  trackEvent("go_view", { path: window.location.pathname });
})();
