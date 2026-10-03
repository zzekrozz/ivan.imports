# Revisión previa a producción

## Capturas auténticas pendientes
Colocar las cuatro imágenes en assets/como-encontrar-coches/capturas/:
- hero.webp: captura 16:9 del curso con vídeo visible (recomendado 1600 × 900).
- area-alumno.webp: área real del alumno con las lecciones (1280 × 720).
- busqueda-real.webp: fotograma real de una búsqueda (1280 × 720).
- caso-practico.webp: fotograma real de un caso práctico (1280 × 720).
Ocultar datos personales. No generar imágenes ficticias.

Actualizar COURSE_PREVIEWS en assets/como-encontrar-coches/config.js:
hero = "/assets/como-encontrar-coches/capturas/hero.webp"
studentArea = "/assets/como-encontrar-coches/capturas/area-alumno.webp"
search = "/assets/como-encontrar-coches/capturas/busqueda-real.webp"
analysis = "/assets/como-encontrar-coches/capturas/caso-practico.webp"

Las ranuras vacías están ocultas; no aparece ningún texto pendiente en público.

## Checkout
CHECKOUT_URL en assets/como-encontrar-coches/config.js sigue siendo "#".
Sustituir por URL HTTPS real de Systeme.io: los cuatro CTA se generan desde ella.
Configurar el precio final 59 € en Systeme.io, sin suplementos al confirmar.
El 1 de noviembre actualizar manualmente CURRENT_PRICE a 99 y la campaña en web/checkout: el código no cambia el precio automáticamente.
El checkout debe enlazar las condiciones y recoger consentimiento expreso de acceso inmediato y reconocimiento de pérdida de desistimiento de contenido digital, con confirmación contractual. La landing no puede verificar el checkout externo mientras no exista URL.

## Consentimiento
El build normaliza también los HTML históricos. El QA se ejecuta sobre dist.
No se solicita GTM antes de aceptar Analítica; publicidad permanece denegada.
Revisar la configuración administrativa de GTM-PRKZJFTT: solo etiquetas analíticas, con requisitos de consentimiento, especialmente para etiquetas HTML personalizadas. El código de la web no permite inspeccionar esa configuración.
