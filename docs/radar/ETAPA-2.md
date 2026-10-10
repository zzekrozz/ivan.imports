# Radar · Etapa 2 · Administrador y publicación real

## Lo que se puede hacer ya (probado)
Entrar → **Añadir vehículo** → guardar borrador → fotos → publicar → verlo en `/radar/` → editar → archivar/retirar, sin tocar código.
Probado con navegador real (Chromium) contra el handler real, con Redis y Blob simulados y **sin Google real**: ver "Qué no está verificado".

## Cambios respecto a la Etapa 1
1. **Alta inicial.** Si `RADAR_ADMIN_GOOGLE_SUBS` está vacío, `/radar/admin/` entra en *modo de alta*: «Continuar con Google» muestra **tu propio `sub`** y no crea sesión ni guarda ni registra nada. Cópialo a Vercel y redespliega; el modo de alta desaparece. Ya no se escribe ningún identificador en los logs.
2. **Estados separados.** `editorialStatus` (draft · express · analyzing · reviewed · discarded) y `listingStatus` (available · pending · withdrawn · sold · archived). Activa = publicada + anuncio disponible/pendiente + no descartada. Archivada, retirada, vendida o descartada → *archivo*: Gratis solo ve datos básicos (sin análisis, costes, comparables ni preguntas) y nunca cuenta como «oportunidad reservada».
3. **Interfaz V5** recuperada (`assets/radar/app.css`, `render.js`, `app.js`): lista horizontal, ficha, tipografía Manrope + Barlow Condensed, paleta, logo A, niebla de guerra con contador real, calculadora plegable, estados Express/Revisado, responsive. Sin datos de demostración en producción.
4. **Gastos sin importes inventados** (`assets/radar/cost-model.js`): catálogo de conceptos y reglas; **ningún importe por defecto**. Los importes salen de tu formulario o de tus plantillas. Escenarios *camión* y *recoger* excluyentes; el modelo 576 es el impuesto de matriculación, no otro gasto; el coche se cuenta una vez; lo pendiente marca la estimación como parcial.

## Preview estable para el inicio de sesión real con Google
Las URLs `*-<hash>.vercel.app` cambian en cada despliegue y Google exige orígenes exactos. Opciones, de más a menos estable:
- **A (recomendada): dominio fijo para la rama.** Vercel → Project → Settings → Domains → *Add* `radar-preview.ivanimports.es` → *Git Branch* = `radar/integracion-etapas-1-2` (y crea el CNAME que indique Vercel). Origen de Google: `https://radar-preview.ivanimports.es`.
- **B:** la URL de rama de Vercel (`<proyecto>-git-radar-integracion-etapas-1-2-<equipo>.vercel.app`), estable mientras no cambie el nombre de la rama.
- En Google Cloud → Credenciales → tu ID de cliente → *Orígenes de JavaScript autorizados*: añade ese origen (y `https://ivanimports.es` solo cuando se pruebe en producción).
- En Vercel (entorno **Preview**, rama de Radar): `RADAR_GOOGLE_CLIENT_ID`, `RADAR_SESSION_SECRET`, `RADAR_BLOB_READ_WRITE_TOKEN`, `RADAR_ADMIN_GOOGLE_SUBS` (vacío la primera vez) y, si usas un dominio distinto del de la petición, `RADAR_ALLOWED_ORIGINS`. Las cookies llevan prefijo `__Host-` fuera de desarrollo, por lo que el preview **debe** servirse por HTTPS (Vercel lo hace).
- Lista de comprobación: (1) abrir `/radar/admin/` → modo de alta → copiar `sub`; (2) pegarlo en `RADAR_ADMIN_GOOGLE_SUBS` y redesplegar; (3) iniciar sesión; (4) probar con otra cuenta de Google → «Esta cuenta no tiene acceso»; (5) subir una foto; (6) publicar un Express gratis y abrirlo en una ventana privada; (7) cerrar sesión.

## Fotografías
Vercel Blob **público** (solo para imágenes de catálogo). El navegador reduce a 1600 px y reencodifica a JPEG (elimina EXIF) antes de subir; el servidor comprueba la firma real del archivo (JPEG/PNG/WebP), máx. 3 MB, y solo acepta URLs de ese almacenamiento al guardar. Hay casilla obligatoria de permiso de uso. **No** se guardan imágenes en Redis ni en base64. Los vídeos (Etapa 5) necesitarán otra solución porque el contenido PRO no puede ir por URL pública permanente.

## Datos (Redis, prefijo `radar:v1:<entorno>:`, ver INTEGRACION.md)
`vehicle:<id>` (JSON con `version`), `slug:<slug>`, `idx:all`, `idx:published`, `template:<id>`, `idx:templates`, `vehicle-history:<id>` (últimas 20 versiones), `audit`, `session:*`, `nonce-used:*`, `rl:*`. Escritura con compare-and-set por versión (Lua `EVAL`); creación idempotente con `clientId`.

## Estado
| Funciona (probado) | Implementado, necesita configuración | Sigue siendo demostración / pendiente |
|---|---|---|
| CRUD de vehículos, borradores, publicar/despublicar, archivar/retirar, validación, versiones y conflictos, fotos (con Blob simulado), plantillas de gastos, análisis, comparables, preguntas, riesgos, acceso Gratis/PRO/PRO abierto/diferido en servidor, catálogo y ficha V5 con datos reales | Google OAuth real, `RADAR_*` en Vercel, Blob store público, Redis (Upstash) en preview | Vídeo, votaciones reales, cuentas de clientes PRO, pagos, alertas, comparador, importación desde enlaces, IVI/carVertical (solo espacios desactivados) |

## Qué no está verificado
- **Inicio de sesión real con Google en Preview**: no se ha podido probar. No se declara listo para producción.
- **Subida real a Vercel Blob** y **Upstash real** (las pruebas usan simulaciones; el `EVAL` de Lua debe comprobarse en Upstash).
- Páginas públicas en `noindex` hasta que decidas publicarlas en buscadores.
