export function consentHead() {
  return '<script data-consent-default>window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",functionality_storage:"granted",security_storage:"granted"});</script><link rel="stylesheet" href="/assets/consent.css"><script src="/assets/consent.js" defer></script>';
}

// Los HTML históricos también se distribuyen con consentimiento previo.
// No se carga el iframe noscript: permitiría activar GTM sin consentimiento.
export function normalizeHtmlConsent(html) {
  let result = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => /googletagmanager\.com/.test(tag) ? "" : tag);
  result = result.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, (tag) => /googletagmanager\.com/.test(tag) ? "" : tag);
  if (!result.includes("data-consent-default")) result = result.replace(/<head\b[^>]*>/i, (head) => head + consentHead());
  return result;
}
