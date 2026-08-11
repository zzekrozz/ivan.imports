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
  const promoProgress = document.querySelector("[data-go-progress]");
  const promoProgressValue = document.querySelector("[data-go-progress-value]");
  const promoProgressSegments = document.querySelector("[data-go-progress-segments]");

  if (promoBadge && promo.active === true && String(promo.label || "").trim()) {
    promoBadge.textContent = String(promo.label).trim();
    promoBadge.hidden = false;
  }

  if (promoCode && promo.active === true && String(promo.code || "").trim()) {
    promoCode.textContent = `CÓDIGO: ${String(promo.code).trim()}`;
    promoCode.hidden = false;
  }

  const progressTotal = Math.min(20, Math.max(1, Math.trunc(Number(promo.total) || 0)));
  const progressUsed = Math.min(progressTotal, Math.max(0, Math.trunc(Number(promo.used) || 0)));
  if (promoProgress && promoProgressValue && promoProgressSegments && promo.active === true && promo.progressActive === true && progressTotal > 0) {
    promoProgressValue.textContent = `${progressUsed}/${progressTotal}`;
    promoProgressSegments.style.setProperty("--progress-total", String(progressTotal));
    promoProgressSegments.replaceChildren(...Array.from({ length: progressTotal }, (_, index) => {
      const segment = document.createElement("i");
      if (index < progressUsed) segment.className = "is-used";
      return segment;
    }));
    promoProgress.setAttribute("aria-label", `${progressUsed} de ${progressTotal} plazas utilizadas`);
    promoProgress.removeAttribute("aria-hidden");
    promoProgress.hidden = false;
  }

  document.querySelectorAll("[data-go-track]").forEach(bindTrackedLink);
  trackEvent("go_view", { path: window.location.pathname });
})();
