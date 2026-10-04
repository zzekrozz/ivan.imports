import { readFileSync } from "node:fs";
import * as defaultConfig from "../assets/como-encontrar-coches/config.js";
import { consentHead } from "./consent-markup.mjs";

const reference = readFileSync(new URL("../docs/referencia-landing.html", import.meta.url), "utf8");
const escape = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function renderRevenderLanding(config = defaultConfig) {
 const { CURRENT_PRICE, FUTURE_PRICE, PRICE_CHANGE_DATE, CHECKOUT_URL, STUDENT_ACCESS_URL, OG_IMAGE } = config;
 const formatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
 const change = new Date(PRICE_CHANGE_DATE + "T00:00:00Z");
 const until = new Date(change.getTime() - 86400000);
 const changeLabel = formatter.format(change);
 const untilLabel = formatter.format(until);
 let html = reference.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/assets/como-encontrar-coches/landing.css">')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts.googleapis.com[^"]+">/, "")
  .replace(/<script>[\s\S]*?<\/script>/, "");
 html = html.replaceAll("59 €", escape(CURRENT_PRICE) + " €").replaceAll("99 €", escape(FUTURE_PRICE) + " €")
  .replaceAll("1 de noviembre", escape(changeLabel)).replaceAll("31 de octubre", escape(untilLabel));
 const canonical = "https://ivanimports.es/como-encontrar-coches-para-revender/";
 const title = "Cómo encontrar coches para revender | IvanImports";
 const description = "Aprende estrategias reales para encontrar vehículos en Europa, analizar el precio de mercado, calcular gastos y detectar oportunidades antes de comprar.";
 html = html.replace(/<title>[^<]+<\/title>/, '<title>' + title + '</title><meta name="description" content="' + description + '"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="' + canonical + '"><link rel="icon" href="/favicon.svg"><meta property="og:site_name" content="IvanImports"><meta property="og:locale" content="es_ES"><meta property="og:type" content="website"><meta property="og:title" content="' + title + '"><meta property="og:description" content="' + description + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="https://ivanimports.es' + escape(OG_IMAGE) + '"><meta name="twitter:card" content="summary_large_image">');
 html = html.replace("</head>", '<link rel="preload" href="/assets/como-encontrar-coches/fonts/BarlowCondensed-ExtraBold.woff2" as="font" type="font/woff2" crossorigin>' + consentHead() + "</head>");
 html = html.replace("<body>", '<body class="revender-page" data-mobile-cta="true" data-page-event="revender_landing_viewed" data-page-type="video-training"><a class="skip-link" href="#contenido">Saltar al contenido</a>');
 html = html.replace('<header class="hero">', '<header class="hero rev-hero">')
  .replace('<div class="nav">', '<div class="nav site-nav rev-header">');
 if (/^https:\/\//i.test(STUDENT_ACCESS_URL || "")) html = html.replace('<a href="#precio">Ver precio</a>', '<a class="rev-student-link" href="' + escape(STUDENT_ACCESS_URL) + '">Ya soy alumno · Entrar</a>');
 html = html.replace("</header>", '</header><main id="contenido">').replace("<footer>", '</main><footer class="site-footer ivan-legal-footer">');
 html = html.replace('<section class="dk" id="precio">', '<section class="dk rev-pricing" id="precio">').replace('<section class="dk fin">', '<section class="dk fin rev-pricing" id="acceder">');
 const sectionIds = ["antes-de-comprar","el-problema","fuera-de-mobile","precio-de-mercado","que-aprenderas","casos-reales","actualizaciones","precio","preguntas-frecuentes","acceder"];
 let sectionIndex=0;
 html=html.replace(/<section\b([^>]*)>/g,(_,attributes)=>{const id=sectionIds[sectionIndex++];return '<section'+attributes+(/\bid=/.test(attributes)?'':' id="'+id+'"')+'>';});
 html=html.replace('<div class="pr">','<div class="pr rev-offer">').replace('<div class="tl">','<div class="tl rev-update-price">').replace('<div class="wk">','<div class="wk rev-flow">');
 html=html.replace('<div class="chart">','<div class="chart"><p class="illustration-note" style="margin:0 0 12px">Esquema ilustrativo del análisis</p>');
 const ids = ["hero_cta", "mid_cta", "pricing_cta"];
 let index = 0;
 html = html.replace(/<a class="btn" href="#">/g, () => { const id = ids[index++]; return '<a class="btn" href="' + escape(CHECKOUT_URL) + '" id="' + id + '" data-cta="' + id + '" data-event="revender_checkout_clicked" data-section="' + id + '" data-item="video-training">'; });
 if (index !== 3) throw new Error("La referencia debe conservar sus tres CTA de compra");
 html = html.replace('<a href="#">Aviso legal</a>', '<a href="/aviso-legal">Aviso legal</a>').replace('<a href="#">Privacidad</a>', '<a href="/privacidad">Privacidad</a>').replace('<a href="#">Cookies</a>', '<a href="/cookies">Cookies</a>').replace('<a href="#">Condiciones de compra</a>', '<a href="/condiciones-de-compra">Condiciones de compra</a>').replace("</footer>", '<button type="button" data-consent-open>Configurar cookies</button></footer>');
 html = html.replace("</body>", '<aside class="rev-sticky" aria-label="Acceder a la formación" hidden><a class="btn" href="' + escape(CHECKOUT_URL) + '" id="sticky_mobile_cta" data-cta="sticky_mobile_cta" data-event="revender_checkout_clicked" data-section="sticky_mobile_cta" data-item="video-training">Acceder · ' + escape(CURRENT_PRICE) + ' €</a></aside><script src="/assets/site-config.js" defer></script><script src="/assets/site.js" defer></script><script src="/assets/como-encontrar-coches/landing.js" defer></script></body>');
 return html;
}
