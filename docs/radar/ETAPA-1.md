# Radar · Etapa 1 · Arquitectura y acceso seguro del administrador

## Decisiones (verificadas contra el repositorio)
- **Sitio estático + funciones Vercel** (`outputDirectory: dist`, ~6 funciones). Radar añade **una sola función** `api/radar.js` con `?action=` (mismo patrón que `academy`, `control`, `ivi`), para no acercarnos al límite de funciones del plan.
- **Sin framework nuevo y sin dependencias nuevas.** Node 22, ESM, `fetch` estándar, `node:crypto`.
- **Autenticación con Google sin Firebase.** No existe en el repo una sesión con Google (Academia usa código por email; Mission Control un código de acceso). Se usa *Google Identity Services* en el navegador y el servidor **verifica el ID token (RS256) con las claves públicas de Google**: firma, `iss`, `aud`, `exp`, `iat`, `email_verified` y `nonce`. Evita añadir el SDK de Firebase Admin y el proyecto Firebase, con el mismo nivel de seguridad. Si prefieres Firebase, solo cambia `verifyGoogleIdToken`.
- **Autorización por identidad estable:** el `sub` de Google debe estar en `RADAR_ADMIN_GOOGLE_SUBS` (servidor). El correo no decide nada.
- **Sesión de servidor:** id aleatorio de 256 bits, guardado en Redis solo como HMAC, cookie `__Host-radar_admin` (`HttpOnly; Secure; SameSite=Strict; Path=/`, sin `Domain`).
- **Operaciones que modifican:** exigen sesión + cabecera `x-radar-csrf` + `Origin` propio. El login tiene nonce de un solo uso y límite de intentos.
- **Persistencia:** Upstash Redis existente con prefijo exclusivo `radar:v1:<entorno>:` (Preview y Producción separados; ver INTEGRACION.md). Nada de multimedia en Redis.
- **Rutas:** `/radar/` y `/radar/coche/:slug/` (estáticas, recargables mediante rewrite); `/radar/admin/` lo sirve la función (login o panel según sesión), sin enlace público, `noindex`, `Disallow` en `robots.txt`.
- **Acceso Gratis/PRO en servidor** (`api/_radar/access.js`): los campos que el visitante no puede ver se eliminan antes de responder; no se ocultan con CSS. Todo vehículo nuevo es PRO por defecto.

## Configuración (no hay secretos en el código)
1. **Google Cloud Console** → APIs y servicios → Credenciales → *Crear credenciales* → **ID de cliente de OAuth** → tipo **Aplicación web**. En *Orígenes de JavaScript autorizados* añade `https://ivanimports.es` y la URL de preview de Vercel. No hace falta URI de redirección.
2. **Vercel** → Project → Settings → Environment Variables (primero solo *Preview*):
   - `RADAR_GOOGLE_CLIENT_ID` = el ID de cliente (público).
   - `RADAR_SESSION_SECRET` = 32+ caracteres aleatorios (`openssl rand -base64 48`), distinto de los de Academia.
   - `RADAR_ADMIN_GOOGLE_SUBS` = tu `sub` de Google. Para obtenerlo: déjala **vacía**, abre `/radar/admin/` (modo de alta) e inicia sesión con Google: se muestra tu `sub` en pantalla, sin crear sesión ni registrar nada. Cópialo a la variable y redespliega. (Procedimiento corregido en la Etapa 2.)
   - Opcional: `RADAR_REDIS_REST_URL/TOKEN` (si no, reutiliza `UPSTASH_*`/`KV_*`), `RADAR_ALLOWED_ORIGINS`, `RADAR_SESSION_TTL_SECONDS`.
3. **Comprobar:** abre `/radar/admin/` en preview → «Continuar con Google» → entras al panel con contadores a 0. Con otra cuenta de Google debe dar «Esta cuenta no tiene acceso». Mientras falte alguna variable, la página lista los nombres que faltan y permanece cerrada.

## Estado de la Etapa 1
| Funciona (probado con pruebas automáticas) | Necesita configuración | Aún no existe |
|---|---|---|
| Verificación de ID token de Google, sesiones, CSRF, origen, nonce, límite de intentos, logout, panel cerrado sin configuración, política Gratis/PRO en servidor, contador de reservadas, API pública sin datos PRO, aislamiento de claves | Cliente OAuth de Google, `RADAR_*` en Vercel, comprobar Redis en preview | Crear/editar vehículos, fotos, gastos, vídeo, votaciones reales, cuentas de clientes PRO, pagos |

Limitaciones honestas: las pruebas usan un Google y un Redis simulados; el inicio de sesión real con Google **no se ha podido probar** aquí. El contador de «PRO» no se puede validar para clientes reales hasta que exista autenticación de clientes (hoy todos los visitantes son Gratis y PRO queda cerrado).
