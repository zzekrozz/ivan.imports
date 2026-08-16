# Analizador de anuncios y fichas de vehículos — informe V1

Fecha de validación: 16 de agosto de 2026  
Rama: `agent/vehicle-analyzer-mobilede`  
Commit de implementación: `93503a9` (`feat: add mobile.de vehicle analyzer`)  
Preview: <https://ivan-imports-i74x47ux2-zzekrozzs-projects.vercel.app>

## Resultado

La V1 queda implementada como evolución de la herramienta canónica `ad-analyzer`, sin crear una herramienta número 18. El usuario puede importar una URL compatible, revisar todos los campos, guardar una ficha local, abrirla, editarla, duplicarla, eliminarla y enviar el precio a la calculadora. Si la fuente no es compatible o mobile.de bloquea la lectura, la URL se conserva y se ofrece una ficha manual.

## Arquitectura encontrada y elegida

- Sitio estático con una SPA de Academia, catálogo canónico de 17 herramientas, estado local versionado y funciones serverless de Vercel.
- Provider: `api/_vehicle/mobile-de.js` valida la URL, obtiene HTML público y lo interpreta. El registro `api/_vehicle/providers.js` permite incorporar otras fuentes sin acoplarlas a la UI.
- Normalizador/modelo: `assets/academy/private/vehicle-model.js` convierte cualquier fuente al modelo canónico `Vehicle` y contiene operaciones puras de almacenamiento, deduplicación, actualización y overrides manuales.
- API: `POST /api/vehicle/import`, reescrito a `api/vehicle.js`, funciona con el Request web usado por tests y con el request/response Node de Vercel.
- UI: `assets/academy/app.js` solo consume el modelo normalizado. La ficha y `VehicleCard` no conocen selectores ni HTML de mobile.de.
- Persistencia: `app.state.tools.adAnalyzer.vehicles` en el almacenamiento local ya existente. El DOM nunca es fuente de verdad.

## Modelo Vehicle

El esquema V1 incluye:

- identificación, fuente, ID/URL canónicos y fechas de importación/comprobación;
- marca, modelo, versión, título, carrocería, matriculación, año, kilómetros, combustible, cambio, kW/CV, cilindrada y tracción;
- precio anunciado, bruto, neto, moneda, IVA deducible/tasa y negociable;
- CO2, clase de emisiones, Euro, consumo, puertas, plazas, color, interior, peso y remolque;
- propietarios, accidentes, daños, mantenimiento, no fumador, aptitud para circular, TÜV/HU y garantía;
- VIN, CoC, documentos de matriculación e información de inspección;
- tipo/nombre/empresa/ubicación/teléfono/rating del vendedor;
- descripción, equipamiento, destacados, notas e imágenes HTTPS;
- `fieldSources`, `manualOverrides`, `priceHistory` y campos económicos futuros para comparador, mercado y Radar.

Los valores no encontrados permanecen en `null`; la interfaz muestra «No indicado». Los campos editados manualmente tienen prioridad y no se sobrescriben en una actualización remota.

## Obtención y normalización de mobile.de

La función solicita únicamente HTML público al pulsar «Analizar anuncio». Prioriza JSON-LD y metadatos estructurados; después utiliza fallbacks textuales limitados. No ejecuta código remoto ni renderiza HTML del vendedor. Normaliza:

- kilómetros a entero;
- primera matriculación a `YYYY-MM` cuando existe mes;
- combustible y cambio a enums canónicos;
- kW/CV, derivando uno del otro cuando falta;
- números y precios en formatos alemanes/internacionales;
- países y tipo de vendedor;
- booleanos sensibles solo cuando hay una señal expresa;
- listas, texto y URLs de imagen HTTPS con límites.

No se soportan todavía búsquedas masivas, comparador estadístico, scoring, traducción, análisis fiscal español, sincronización cloud ni descarga/almacenamiento de imágenes. Los campos que mobile.de no publica o cuya señal no es inequívoca se conservan como ausentes.

## Seguridad

- Solo `https:` y los hosts `mobile.de`, `www.mobile.de`, `suchen.mobile.de` y `m.mobile.de`.
- Bloqueo de otros dominios, IPs, localhost, protocolos y redirects fuera de whitelist.
- Máximo de 3 redirects, timeout de 10 segundos, respuesta máxima de 2 MB y exigencia de HTML.
- URL canónica sin tracking; duplicado por `source + sourceListingId`.
- Descripción remota como texto escapado; imágenes solo HTTPS; sin secretos en cliente ni analítica.
- Eventos: `vehicle_import_started`, `vehicle_import_success`, `vehicle_import_failed` y `vehicle_manual_created`, sin URL completa, VIN, teléfono ni descripción.
- Build: cero PDFs premium públicos. No se añadió ningún PDF ni ruta `private-products`. Escaneo del diff sin patrones evidentes de secretos.

## Experiencia implementada

- Hero «Analiza un anuncio», input URL grande, loading accesible y mensajes amistosos.
- Ficha visual con precio, badges, datos principales, fiscalidad declarada, estado/historial, equipamiento, descripción, alertas deterministas y vendedor.
- Formulario editable de 35 campos con labels; creación manual y prioridad de overrides.
- Biblioteca «Mis vehículos» con tarjetas reusables.
- Abrir, editar, actualizar desde mobile.de, duplicar, eliminar y abrir el original.
- «Calcular operación» reutiliza la calculadora existente y rellena el precio de compra.
- SEO estático: title «Analizador de anuncios de coches de Alemania | IvanImports», H1 «Analiza un anuncio de coche antes de comprarlo» y explicación útil previa a JavaScript.
- Versión de Academia `1.1.0` y cache-busting de CSS/JS para evitar servir la UI anterior.

## Archivos

Archivos nuevos de implementación:

- `api/vehicle.js`
- `api/_vehicle/mobile-de.js`
- `api/_vehicle/providers.js`
- `assets/academy/private/vehicle-model.js`
- tres fixtures sanitizados en `tests/fixtures/mobile-de/`
- cuatro suites en `tests/vehicle-*.test.js` y `tests/mobile-de-provider.test.js`

Archivos modificados principales:

- `assets/academy/app.js`, `assets/academy/app.css`, `assets/academy/patch-notes.js`
- `api/_academy/shell.js`, `vercel.json`, `package.json`
- `scripts/build-public-pages.mjs`
- tres tests de infraestructura adaptados al checkout público sin fuentes privadas
- páginas estáticas generadas de Academia, modificadas únicamente para publicar el nuevo SEO y la versión de assets.

El commit de implementación contiene 146 archivos: 1.280 inserciones y 253 eliminaciones. La mayoría son páginas generadas cuyo cambio funcional es la query de versión de CSS/JS.

## Tests y QA

- Lint: PASS, 337 archivos y 68 scripts.
- Typecheck/syntax check: PASS.
- Suite completa: 188 tests; 179 PASS, 0 FAIL, 9 SKIP. Los skips requieren fuentes editoriales privadas que deliberadamente no forman parte del checkout público.
- Tests específicos del vehículo/provider/API/UI: 16/16 PASS.
- Cobertura editorial: 72/72 lecciones, 199/199 segmentos y 150/150 páginas; 19/19 tests PASS.
- Academia Experience QA estricto: 20/20, 0 blockers, 0 warnings.
- Build: PASS; 13 etapas, 72 lecciones, 19 conceptos SEO, 17 herramientas, 5 servicios, 0 enlaces internos sin destino y 0 PDFs premium públicos.
- `git diff --check`: PASS; solo avisos informativos de conversión LF/CRLF de Git en Windows.

## Browser QA local

Resoluciones verificadas: 1440×1000, 1280×900, 1024×900, 430×844, 390×844 y 360×800.

- 0 errores de consola de la aplicación.
- 0 overflow horizontal.
- 0 campos cortados; 35 campos presentes.
- H1, botones, mensajes y navegación visibles.
- Targets móviles de 44–50 px y foco inicial correcto en «Marca».
- Creación manual, guardado, recarga/persistencia, apertura, edición y duplicado: PASS.
- Envío de 12.900 € a la calculadora: PASS.
- Fuente no compatible y bloqueo real de mobile.de: mensajes y CTA manual PASS.
- La eliminación está cubierta por test unitario; no se confirmó el diálogo destructivo durante la automatización visual.
- El éxito de una importación automática y su duplicado están cubiertos con fixtures/API/modelo porque el proveedor bloqueó el acceso live.

## QA del Preview

Vercel desplegó el commit y lo marcó `Ready`. La URL está protegida con Vercel Authentication: un navegador no autenticado es redirigido al login, y no había una sesión externa de Chrome conectada. No se cambió la protección del proyecto.

Mediante `vercel curl`, que usa la sesión autenticada existente:

- página del analizador: HTTP 200, SEO correcto y assets `1.1.0-vehicle3`;
- URL no compatible: HTTP 422, error público `unsupported_source`;
- anuncio real de mobile.de: HTTP 503 controlado, error público `provider_blocked`.

Por ello, el render responsive se validó sobre el mismo commit en el servidor local; en el Preview se verificaron despliegue, HTML, assets y función serverless, pero no se pudo repetir el render visual dentro del navegador protegido.

## Prueba real de mobile.de y limitaciones

Se intentó el anuncio público:

`https://suchen.mobile.de/fahrzeuge/details.html?id=459800097`

También se intentó una página pública de búsqueda:

`https://suchen.mobile.de/auto/bmw-2er-reihe-diesel-automatik.html`

Mobile.de respondió HTTP 403 a las solicitudes server-side de este entorno. El endpoint del Preview traduce esa respuesta a un 503 controlado y la UI ofrece creación manual sin perder la URL. No se intentó eludir CAPTCHA, autenticación ni protección anti-bot. Los tres fixtures offline validan diésel automático profesional con IVA, gasolina manual dañada/no apta/particular y eléctrico con campos faltantes.

La alternativa legítima para producción es acordar acceso autorizado/API/partnership con mobile.de o mantener la entrada manual cuando la lectura pública sea rechazada. No hay un bug no controlado en IvanImports, pero la disponibilidad automática live depende de que mobile.de permita la solicitud.

## Estado de entrega

- Implementación, validaciones, commit, push y Preview: completados.
- `main`: sin cambios.
- Producción: sin deploy manual.
- PR: no abierto.
- Limitación conocida: Vercel Authentication impide Browser QA directo del Preview sin una sesión autorizada; mobile.de rechaza las solicitudes live con 403.

