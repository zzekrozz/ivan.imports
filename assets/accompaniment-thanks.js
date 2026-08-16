(() => {
  "use strict";

  const sessionId = String(window.__IVAN_ACCOMPANIMENT_SESSION__ || "");
  const qaState = String(window.__IVAN_ACCOMPANIMENT_QA_STATE__ || "");
  delete window.__IVAN_ACCOMPANIMENT_SESSION__;
  delete window.__IVAN_ACCOMPANIMENT_QA_STATE__;

  const title = document.querySelector("[data-payment-title]");
  const lead = document.querySelector("[data-payment-lead]");
  const copy = document.querySelector("[data-payment-copy]");
  const eyebrow = document.querySelector("[data-payment-eyebrow]");
  const label = document.querySelector("[data-payment-label]");
  const checking = document.querySelector("[data-checking-content]");
  const confirmed = document.querySelector("[data-confirmed-content]");
  const unverified = document.querySelector("[data-unverified-content]");

  const states = {
    confirmed: {
      eyebrow: "Ya podemos empezar",
      title: "¡Pago recibido! 🎉",
      lead: "Felicidades. Ya formas parte de Acompañamiento Completo.",
      copy: "Ahora empieza lo bueno: vamos a buscar, analizar y traer tu primer coche desde Europa con un proceso claro y acompañado de principio a fin.",
      label: "Pago confirmado",
    },
    pending: {
      eyebrow: "Confirmación en curso",
      title: "Estamos confirmando tu pago",
      lead: "",
      copy: "Tu operación se ha recibido y estamos esperando la confirmación definitiva.",
      label: "Pago procesándose",
    },
    unverified: {
      eyebrow: "Necesitamos revisar el enlace",
      title: "No hemos podido verificar el pago desde este enlace.",
      lead: "",
      copy: "Puedes escribirme y te ayudaré a revisar el siguiente paso sin mostrar datos de la operación aquí.",
      label: "Sesión no verificada",
    },
  };

  function setState(status) {
    const state = states[status] || states.unverified;
    document.body.dataset.paymentStatus = status;
    eyebrow.textContent = state.eyebrow;
    title.textContent = state.title;
    lead.textContent = state.lead;
    lead.hidden = !state.lead;
    copy.textContent = state.copy;
    label.textContent = state.label;
    checking.hidden = true;
    confirmed.hidden = status !== "confirmed";
    unverified.hidden = status !== "unverified";
    document.title = `${state.title.replace(" 🎉", "")} | IvanImports`;
    window.trackIvanImportsEvent?.(`accompaniment_payment_${status}`);
  }

  async function verifyPayment() {
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{16,}$/.test(sessionId)) {
      setState("unverified");
      return;
    }
    try {
      const response = await fetch("/api/acompanamiento/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ session_id: sessionId }),
      });
      const result = await response.json().catch(() => ({}));
      if (result.status === "confirmed" || result.status === "pending") setState(result.status);
      else setState("unverified");
    } catch {
      setState("unverified");
    }
  }

  if (new Set(["confirmed", "pending", "unverified"]).has(qaState)) setState(qaState);
  else verifyPayment();
})();
