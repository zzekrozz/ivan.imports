# Landing `Importa tu coche en 7 días`

## Arquitectura

La landing está aislada en `/importa-en-7-dias/` y mantiene su implementación estática en:

- `importa-en-7-dias/index.html`;
- `assets/importa-7-dias/landing.css`;
- `assets/importa-7-dias/landing.js`;
- `assets/importa-7-dias/config.js`.

El rediseño utiliza un hero fotográfico local optimizado, previews reales del producto y un explorador progresivo de doce decisiones. Sin JavaScript, las doce etapas permanecen disponibles en el documento; con JavaScript se muestra un panel activo con navegación, historial, controles y progreso.

La URL de vídeo es opcional. Si `videoUrl` está vacía, el bloque completo permanece oculto y no carga ningún reproductor.

## Venta y entrega

El Payment Link LIVE se centraliza exclusivamente en `assets/importa-7-dias/config.js`. Todos los CTA utilizan `data-purchase-cta` y reciben la misma URL en tiempo de ejecución, conservando `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `ref`.

La confirmación, entrega por email, idempotencia, Redis, Resend, HMAC y acceso al Blob privado permanecen en `api/importa-7-dias.js`. Los PDFs originales no forman parte de este repositorio, no se publican como assets y no deben copiarse a una ruta pública.

La página `/importa-en-7-dias/gracias/` verifica `session_id` en el servidor y no debe simplificarse a una confirmación visual basada únicamente en parámetros de URL.

## Contador y contacto directo

El contacto directo durante 14 días se incluye en compras realizadas hasta `2026-08-16T23:59:59+02:00`. El estado se calcula con la fecha real del dispositivo, sin `localStorage`. Al expirar se ocultan el banner, el contador, el bloque de acompañamiento y todas sus menciones; el producto continúa a 179 €.

La misma fecha y duración existen en el servidor para calcular la elegibilidad de cada compra. Cualquier cambio futuro debe actualizar frontend y backend de forma coordinada.

## Analítica

Se reutilizan `dataLayer` y `gtag`. La landing envía eventos de vista, profundidad, CTA, inicio de checkout, FAQ, vídeo y expiración del contador. El explorador añade:

- `importa7_journey_stage_select`, con `stage_id` y origen de navegación;
- `importa7_journey_phase_select`, con fase y etapa de destino.

Los eventos no incluyen datos personales.
