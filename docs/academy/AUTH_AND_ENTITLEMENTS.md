# Auth and entitlements

## Flujo de compra

1. Stripe valida pago, producto, moneda e importe en la integración existente.
2. El webhook concede un entitlement idempotente para `importa-tu-primer-coche`.
3. La entrega actual de guía/cuaderno continúa disponible.
4. El comprador puede entrar desde gracias, email o `/academia/acceso/`.

No se crea otro producto ni Price de Stripe. La academia extiende el acceso actual.

## Recuperación de acceso

1. El usuario introduce el email de compra.
2. La respuesta es neutral para no revelar si existe una cuenta.
3. Si hay entitlement, se emiten código de seis cifras y enlace opaco de un solo uso.
4. Los digests, no los secretos en claro, se guardan temporalmente.
5. Código o enlace consumen un gate único.
6. Se crea una sesión opaca y una cookie `HttpOnly`, `SameSite=Lax`; producción añade `Secure` y prefijo `__Host-`.
7. El retorno solo acepta rutas allowlisted del mismo origen.

## Autorización

Todas las rutas privadas y acciones de programa/estado/recursos vuelven a resolver sesión y entitlement en servidor. Ocultar un enlace nunca se considera control de acceso.

Un entitlement activo no caduca silenciosamente. La revocación debe ser explícita. El bonus de soporte sí puede tener `startsAt`, `endsAt` y estado propios.

## Recursos privados

`file` solo admite `guide` o `workbook`. El backend resuelve el pathname configurado y entrega el archivo al usuario autorizado. El JSON premium se carga desde Blob privado mediante `ACADEMY_CONTENT_BLOB_PATHNAME`; el pathname no forma parte de la respuesta del programa.

## Variables de entorno

- `ACADEMY_REDIS_REST_URL` / `ACADEMY_REDIS_REST_TOKEN` o las variables Upstash/KV existentes.
- `ACADEMY_AUTH_SECRET`, `ACADEMY_DATA_SECRET`, `ACADEMY_SESSION_SECRET` (mínimo 32 caracteres).
- `ACADEMY_BASE_URL`.
- `ACADEMY_CONTENT_BLOB_PATHNAME`.
- `ACADEMY_SESSION_TTL_SECONDS`, `ACADEMY_CODE_TTL_SECONDS` opcionales.
- `ACADEMY_FROM_EMAIL` o `RESEND_FROM_EMAIL`, y `RESEND_API_KEY`.
- `ACADEMY_DEMO_TOKEN` y `ACADEMY_DEMO_SESSION_TTL_SECONDS` solo para un modo de presentación autorizado.
- `ACADEMY_ADMIN_API_TOKEN` (mínimo 32 caracteres) para grant/revoke server-to-server.
- Variables existentes de pathnames privados de guía/cuaderno.

No se documentan valores ni secretos.

## Administración

Los scripts manuales no conocen Redis ni aceptan tokens por argumento. En modo `--apply` exigen `ACADEMY_ADMIN_API_URL=https://ivanimports.es/api/academy/admin/entitlement` y `ACADEMY_ADMIN_API_TOKEN`. El endpoint acepta únicamente `POST`, autentica el Bearer en tiempo constante, normaliza el email en servidor, audita solo una referencia HMAC y ejecuta grant/revoke idempotente. Revoke conserva un tombstone explícito, invalida las sesiones indexadas y no puede ser deshecho por el reenvío de un webhook; una reactivación exige un grant administrativo autenticado.

## Demo controlada

`POST /api/academy/demo` canjea `Authorization: Bearer <ACADEMY_DEMO_TOKEN>` por una cookie `HttpOnly` de corta duración. El token no se admite en query strings. Desde la consola del navegador abierta en el mismo origen:

```js
let token = prompt("Token demo");
await fetch("/api/academy/demo", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
token = "";
location.assign("/ruta");
```

La sesión demo recibe un dataset seguro no premium con las 13 etapas, lecciones de muestra y una herramienta marcada como demo. Su estado es efímero y de solo lectura; nunca consulta el Blob de contenido, guía o cuaderno.

## CSP y soporte

La shell mantiene `script-src 'self'` sin scripts inline. `style-src` permite `'unsafe-inline'` únicamente para los atributos de presentación y variables CSS generados por el cliente. El CTA de WhatsApp solo se devuelve dentro de una sesión con entitlement bonus activo, fecha vigente y `IMPORTA_7_DIAS_SUPPORT_PHONE_E164` válido; no forma parte del catálogo público ni de demo.

## Amenazas y controles

- Enumeración de compradores: respuesta neutral.
- Fuerza bruta: rate limit, TTL e intentos.
- Reutilización: gate y tokens de un solo uso.
- Robo de cookie: `HttpOnly`, `SameSite`, `Secure` en producción y logout servidor.
- Open redirect: allowlist de rutas.
- IDOR: subject tomado de sesión, no del payload.
- Estado malicioso: esquema, límites y bloqueo de claves peligrosas.
- Filtración de contenido: Blob privado, no Git, no `dist`, no URL interna en JSON de respuesta.

## Privacidad, DPA y retención

La autenticación y el estado añaden tratamiento de datos que debe aparecer en la política aprobada antes de producción. La implementación minimiza identificadores mediante subjects HMAC, pero el estado del alumno puede contener información de una operación, candidatos, presupuesto y, si el producto lo permite, datos de vehículo. No deben guardarse imágenes de documentos, identidad de terceros ni datos innecesarios en este payload.

Los desafíos, códigos, enlaces, rate limits y sesiones tienen TTL técnico configurable. Ese TTL debe coincidir con el plazo publicado. Entitlement, estado, auditoría administrativa y tombstones no deben adquirir un plazo inventado: producto/legal debe aprobar una matriz que defina conservación durante acceso activo, revocación, cierre de cuenta, solicitud de supresión y obligaciones de compra/contabilidad.

Antes del lanzamiento deben estar identificados los encargados y subencargados efectivos —hosting/Blob, Redis/KV, email transaccional, Stripe y analítica—, con DPA y transferencias revisados cuando apliquen. El flujo de supresión debe invalidar sesiones y desafíos, eliminar o anonimizar estado y respetar únicamente la información que deba conservarse con base documentada. Los tombstones administrativos necesitan finalidad, acceso y caducidad aprobados; no son una autorización para retener indefinidamente.
