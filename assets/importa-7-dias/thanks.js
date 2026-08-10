(() => {
  "use strict";

  const statePanels = [...document.querySelectorAll("[data-order-panel]")];
  const confirmedContent = [...document.querySelectorAll("[data-confirmed-content]")];
  const verificationVisual = document.querySelector("[data-verification-visual]");
  const header = document.querySelector("[data-order-header]");
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id") || "";
  const isLocalQa = new Set(["127.0.0.1", "localhost"]).has(url.hostname);
  const localQaState = isLocalQa ? url.searchParams.get("qa_state") || "" : "";

  // El ID se conserva solo en memoria y se elimina antes de cargar cualquier script externo.
  if (window.history?.replaceState && url.search) {
    window.history.replaceState(null, "", `${url.pathname}${url.hash}`);
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });

  function track(event, params = {}) {
    window.dataLayer.push({ event, ...params });
  }

  function loadAnalytics() {
    if (isLocalQa) return;
    if (document.querySelector("script[data-importa7-gtm]")) return;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.async = true;
    script.dataset.importa7Gtm = "true";
    script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-PRKZJFTT";
    document.head.appendChild(script);
  }

  function setState(status, data = {}) {
    document.body.dataset.orderStatus = status;
    statePanels.forEach((panel) => { panel.hidden = panel.dataset.orderPanel !== status; });
    const confirmed = status === "confirmed";
    confirmedContent.forEach((element) => { element.hidden = !confirmed; });
    if (verificationVisual) verificationVisual.hidden = confirmed;

    const labels = {
      checking: "Comprobando compra",
      confirmed: "Compra confirmada",
      pending: "Pago en proceso",
      unverified: "Compra no verificada",
    };
    if (header) header.textContent = labels[status] || labels.unverified;

    if (confirmed) {
      document.querySelectorAll("[data-masked-email]").forEach((element) => {
        element.textContent = data.masked_email || "tu correo de compra";
      });
      document.querySelectorAll("[data-support-days]").forEach((element) => {
        element.textContent = "14";
      });
      document.querySelectorAll("[data-thank-you-launch]").forEach((section) => {
        section.hidden = !data.bonus_eligible;
      });
      initReveal();
      document.title = "Compra confirmada | Importa tu coche en 7 días";
      track("importa7_purchase_verified", { bonus_eligible: Boolean(data.bonus_eligible) });
    } else if (status === "pending") {
      document.title = "Pago en proceso | Importa tu coche en 7 días";
      track("importa7_payment_pending");
    } else if (status === "unverified") {
      document.title = "Compra no verificada | Importa tu coche en 7 días";
      track("importa7_purchase_unverified");
    }
    loadAnalytics();
  }

  function initReveal() {
    const elements = document.querySelectorAll("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px" });
    elements.forEach((element) => observer.observe(element));
  }

  async function verifyOrder() {
    track("importa7_thankyou_checking");
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{16,}$/.test(sessionId)) {
      setState("unverified");
      return;
    }

    try {
      const response = await fetch("/api/importa-7-dias/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ session_id: sessionId }),
      });
      const result = await response.json().catch(() => ({}));
      if (result.status === "confirmed") setState("confirmed", result);
      else if (result.status === "pending") setState("pending", result);
      else setState("unverified");
    } catch {
      setState("unverified");
    }
  }

  if (localQaState === "confirmed") {
    setState("confirmed", { masked_email: "iv******@example.com", bonus_eligible: true });
  } else if (localQaState === "pending" || localQaState === "unverified") {
    setState(localQaState);
  } else {
    verifyOrder();
  }
})();
