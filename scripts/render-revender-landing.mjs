import { readFileSync } from "node:fs";
import { consentHead } from "./consent-markup.mjs";
import * as defaultConfig from "../assets/como-encontrar-coches/config.js";

const reference = readFileSync(new URL("../docs/landing-final/como-encontrar-coches-para-revender.html", import.meta.url), "utf8");
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// La referencia aprobada es la fuente visual y funcional: no se reconstruye su markup ni su CSS.
export function renderRevenderLanding(config = defaultConfig) {
  const { CHECKOUT_URL, CURRENT_PRICE, FUTURE_PRICE, PRICE_CHANGE_DATE } = config;
  const changeDate = new Date(PRICE_CHANGE_DATE + "T00:00:00Z");
  const formatDate = (date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  const previousDate = new Date(changeDate.getTime() - 86400000);
  let html = reference
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll("59 €", CURRENT_PRICE + " €")
    .replaceAll("99 €", FUTURE_PRICE + " €")
    .replaceAll("31 de octubre", formatDate(previousDate))
    .replaceAll("1 de noviembre", formatDate(changeDate));
  html = html.replace(/(<a\b[^>]*\bdata-cta="([^"]+)"[^>]*>)/g, (tag, _anchor, section) => {
    const trackingSection = { hero: "hero_cta", precio: "mid_cta", final: "pricing_cta" }[section];
    return tag.replace(/href="[^"]*"/, 'href="' + escape(CHECKOUT_URL) + '"').replace(/>$/, ' data-event="revender_checkout_clicked" data-section="' + trackingSection + '" data-item="video-training">');
  });
  html = html.replace(/var CHECKOUT_URL="[^"]*";/, "var CHECKOUT_URL=" + JSON.stringify(CHECKOUT_URL).replaceAll("<", "\\u003c") + ";");
  html = html.replace("</head>", consentHead() + "\n</head>");
  // Evita que el shell global añada una navegación móvil ajena a la referencia.
  html = html.replace("<body>", '<body data-mobile-cta="true" data-page-event="revender_landing_viewed" data-page-type="video-training">');
  html = html.replace("</body>", '<script src="/assets/site-config.js" defer></script><script src="/assets/site.js" defer></script>\n</body>');
  return html;
}
