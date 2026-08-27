# Mission Control V1

## Arquitectura encontrada

IvanImports es una aplicación web estática con JavaScript ESM, generada a `dist/` y desplegada en Vercel. Las operaciones privadas viven en Vercel Functions. La autenticación existente usa códigos de un solo uso, una cookie `HttpOnly` firmada y sesiones/entitlements en Upstash Redis. No existe Supabase ni un router de framework.

Mission Control permanece encapsulado en `assets/control/`, `api/_control/`, `api/control.js` y la ruta `/control`. No aparece en la navegación pública, no entra en el sitemap y se marca `noindex` tanto en HTML como en cabeceras y `robots.txt`.

El acceso usa un único código privado. Puede rotarse mediante `MISSION_CONTROL_ACCESS_CODE`; el valor solicitado para esta instalación se conserva únicamente como digest de fallback. La comparación se realiza en servidor y, tras validarla, se emite una cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción. No se solicita email ni se envían códigos temporales.

## Modelo durable y migración

No se necesita una migración SQL. Cada cuenta tiene un agregado versionado en la clave:

`mission-control:v1:user:<user_id>`

El valor contiene un `revision` para control optimista de concurrencia y un `state` con las colecciones `projects`, `quests`, `quest_completions`, `goals`, `ideas`, `user_game_stats`, `activity_log` y `operation_ids`. Todas las entidades incluyen `user_id`; la API deriva ese valor de la sesión y nunca lo acepta del cliente.

La incorporación es aditiva y reversible: eliminar los rewrites/function/assets nuevos deja intacta la web actual. Los datos existentes de Academia usan el namespace `academy:v1:*` y nunca se leen ni modifican como datos de Mission Control. Para retirar solamente los datos del producto se pueden borrar claves `mission-control:v1:user:*` tras exportarlas; la V1 no incluye una operación destructiva de borrado.

## Consistencia

- Las mutaciones usan compare-and-swap en Redis y reintento limitado.
- Cada operación de cliente lleva `operation_id`; los últimos 100 IDs se conservan para idempotencia.
- Una completion se identifica por `quest_id + period_key` y concede XP una sola vez.
- Undo elimina la completion y revierte exactamente `xp_awarded`.
- Las quests recurrentes conservan historial separado de su estado base.
- Nivel, progreso de nivel, periodo de recurrencia, streak y transiciones de XP viven en `assets/control/domain.js`.
- El límite de proyectos activos introduce fricción, pero permite una anulación deliberada.

## PWA readiness

La V1 incluye manifest, colores standalone y una estrategia de icono SVG. No registra service worker para evitar cachear una aplicación privada con estado sensible. Una fase posterior debe añadir un service worker limitado al shell estático, iconos raster 192/512, Web Push con consentimiento, preferencias por usuario y un endpoint programado de notificaciones. El widget futuro abriría `/control/` y consumiría un resumen autenticado de solo lectura.

## Future quests

- Service worker seguro y experiencia offline explícita.
- Web Push matinal/progreso/tarde/streak/cooldown con preferencias anti-spam.
- Badge de app y widget TODAY nativo.
- Motor de recomendación separado de la economía de XP.
- Exportación/importación y panel de ajuste de categorías.
