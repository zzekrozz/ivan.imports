# Radar · Integración de las etapas 1 y 2 en el repositorio

Rama `radar/integracion-etapas-1-2`, creada desde `main` (`c654af4`). El ZIP `radar-etapa-2.zip` se construyó sobre ese mismo `main`: los cinco archivos compartidos (`package.json`, `vercel.json`, `robots.txt`, `scripts/build-check.mjs`, `.env.example`) solo reciben líneas nuevas de Radar. Academia, IVI, Mission Control, landings y legales no se tocan.

## Correcciones aplicadas tras integrar
| # | Problema | Corrección |
|---|---|---|
| 1 | **Redis compartido entre Preview y Producción.** Todas las claves usaban `radar:v1:`; con el Upstash general (`UPSTASH_*`/`KV_*`, el mismo en ambos entornos) un vehículo publicado en Preview salía en Producción y sesiones, nonces y límites se compartían. | Prefijo `radar:v1:<production\|preview\|development>:` derivado de `VERCEL_ENV` (mismo criterio que IVI). Fotos en `radar/<entorno>/vehicles/`. |
| 2 | **Archivo histórico.** Al archivarse un vehículo PRO, PRO abierto o PRO-primero aún no liberado, Gratis veía la primera impresión de Iván y el rango de referencia en España. | En el archivo, Gratis solo ve los datos del anuncio; la opinión y la referencia se conservan únicamente si el vehículo ya era gratuito. PRO sigue viendo todo. |
| 3 | **Caché de «PRO abierto».** La API pública respondía con `s-maxage=5, stale-while-revalidate=30`: un análisis podía seguir sirviéndose desde la CDN ~35 s después de cerrarse. | Toda respuesta con un vehículo `tier: "open"` sale con `Cache-Control: private, no-store`. |
| 4 | **Login con Google.** La página de login enviaba `Referrer-Policy: no-referrer`; Google Identity Services usa el Referer para validar el origen y falla con «The given origin is not allowed». | La página de login usa `strict-origin-when-cross-origin` y `Cross-Origin-Opener-Policy: same-origin-allow-popups`; el panel mantiene `no-referrer`. `.env.example` documenta el modo de alta real y `RADAR_BLOB_READ_WRITE_TOKEN`. |

Datos antiguos: si una preview anterior escribió claves `radar:v1:*` sin entorno, quedan ignoradas (pueden borrarse a mano en Upstash).

## Variables (solo entorno Preview para empezar)
| Variable | Obligatoria | Nota |
|---|---|---|
| `RADAR_GOOGLE_CLIENT_ID` | Sí | ID de cliente OAuth «Aplicación web». Es público. |
| `RADAR_SESSION_SECRET` | Sí | ≥ 32 caracteres aleatorios, distinto de los de Academia. |
| `RADAR_ADMIN_GOOGLE_SUBS` | Vacía la primera vez | Modo de alta → copia tu `sub` → pégalo → redespliega. |
| `RADAR_BLOB_READ_WRITE_TOKEN` | Para subir fotos | Store Blob **público**, solo fotos de catálogo. |
| `RADAR_REDIS_REST_URL/TOKEN` | No | Si se omite, reutiliza `UPSTASH_*`/`KV_*` (ya aislado por entorno). |
| `RADAR_ALLOWED_ORIGINS` | No | Solo si el panel se usa desde un origen distinto del de la petición. |

## Comprobación en Preview
1. Abrir `https://<url-estable-de-la-rama>/radar/admin/` → «Modo de alta inicial» → «Continuar con Google» → copiar el `sub`.
2. Pegarlo en `RADAR_ADMIN_GOOGLE_SUBS` (Preview) → *Redeploy*.
3. Iniciar sesión → panel con contadores a 0. Otra cuenta → «Esta cuenta no tiene acceso».
4. «+ Añadir vehículo» → datos, foto (casilla de permiso) → estado Express → acceso «Gratis básico» → Publicar.
5. Ventana privada: `/radar/` y `/radar/coche/<slug>/` lo muestran. En Producción no aparece.
6. Cerrar sesión.
