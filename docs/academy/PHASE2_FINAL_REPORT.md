# Informe final · Academia IvanImports · Fase 2

Fecha de cierre técnico: 11 de agosto de 2026
Repositorio de trabajo: `work/ivan.imports-publish`
Rama local: `agent/academy-importa-7-dias`
Estado: implementación y QA local completos; sin commit, push ni deploy.

## 1. Resumen ejecutivo

La Academia se ha reconstruido como un producto privado de aprendizaje y ejecución, manteniendo la web estática pública y el checkout existente. El resultado contiene un prólogo, 12 etapas, 72 lecciones, 317 conceptos consultables, 17 herramientas y una ruta visual europea. Los 317 pasos heredados ya no son tareas: migran a conceptos y anchors dentro de las 72 lecciones.

El catálogo premium vive fuera del build público, se entrega solo tras sesión y entitlement y dispone de un uploader v2 que valida el artefacto sin conectarse en modo `--dry-run`. El cierre local está verde: lint, typecheck, 50/50 tests, build, 42/42 controles de experiencia y auditoría de las 150 páginas del PDF.

## 2. Baseline

El repositorio real es una web HTML/CSS/JavaScript ESM con Vercel Functions; no es React ni Next.js. La Fase 1 ya había introducido cambios de Academia, fulfillment y páginas públicas en el mismo worktree. Antes de la Fase 2, el baseline de QA pasaba 27/27 tests y el build público se generaba por allowlist.

Se congelaron hashes normalizados para APIs y scripts de la zona roja. Los cambios justificados posteriores quedaron limitados, revisados y actualizados en el control de regresión.

## 3. Problemas encontrados

- La Academia anterior exponía HTML/JS estático y no podía albergar contenido premium.
- El modelo heredado mostraba 317 pasos como progreso, generando una experiencia excesivamente fragmentada.
- El catálogo inicial mezclaba prólogo y etapas, y varios conceptos derivados del PDF contenían columnas unidas, epígrafes contiguos o respuestas truncadas.
- El primer v2 usó temporalmente un ID de producto incompatible con el entitlement estable.
- El shell generaba landmarks `<main>` anidados.
- Un slug v2 `06-04-*` colisionaba con el alias legacy `/paso/6-04-*`.
- En móvil coexistían dos elementos persistentes; en desktop el aside de lección podía solaparse.
- El mapa mostraba labels superpuestos y una animación anulaba la posición real del coche.
- El demo contabilizaba 13 etapas en vez de 12 etapas más prólogo y ocultaba su distintivo en móvil.

Todos estos hallazgos quedaron corregidos y cubiertos por QA.

## 4. Infraestructura

La arquitectura final separa tres capas:

- `dist/`: web pública generada por allowlist, sin catálogo premium.
- `api/academy.js` y `api/_academy/*`: autenticación, sesión, entitlement, estado CAS, shell protegido, recursos y demo.
- `private-products/academy/v2/`: fuentes editoriales modulares y ensamblado privado, ignorados por Git y Vercel.

Producción carga el programa desde Blob privado. Desarrollo prefiere `private-products/academy/v2/dist/program-v2.json` y conserva el fallback v1. La sesión usa cookie segura, `HttpOnly`, rotación y revocación. Redis puede aislarse mediante variables `ACADEMY_REDIS_*`; el fallback existente se conserva para compatibilidad.

## 5. Las 72 lecciones

El programa contiene exactamente 72 lecciones distribuidas así: `3, 5, 7, 6, 5, 7, 8, 5, 7, 4, 4, 7, 4` entre prólogo y etapas 01–12. Cada lección declara objetivo, explicación sencilla, acción inmediata, error habitual, ejemplo, checklist, decisión, knowledge check, fuentes, estado editorial y visual con propósito.

Estados editoriales: 47 `authored` y 25 `reviewed`. Las siete arquitecturas pedagógicas incluyen ruta narrativa, comparación, cálculo guiado, decoder visual, procedimiento/timeline, simulador de conversación y banco de inspección.

## 6. Los 317 conceptos

Los 317 conceptos tienen ID, título, aliases, respuesta breve, explicación, acción, lección, anchor, páginas fuente y relaciones. Resultado de limpieza final:

- 317 respuestas breves únicas;
- máximo de 135 caracteres;
- cero respuestas idénticas a la explicación;
- cero truncados o elipsis editoriales;
- cero residuos de columnas o del epígrafe siguiente;
- cero acciones heredadas de la plantilla de Fase 1.

Los conceptos se consultan con `details/summary`, búsqueda y deep link, pero no incorporan checkbox ni gobiernan el porcentaje.

## 7. Migración

`assets/academy/private/migration.js` transforma el estado v1 sin mutarlo. Agrupa conceptos legacy completos en lecciones completadas; los grupos parciales pasan a iniciados; conserva lección actual, etapa y anchor; registra la migración y es idempotente.

El mapa canónico contiene 317 mappings y 317 aliases con `legacyLessonId`, `lessonId`, `lessonSlug`, `stageId`, `conceptId` y `anchor`. La precedencia es exacta: un slug v2 gana siempre, mientras `/paso/6-04-*` continúa funcionando como alias antiguo. El PUT/CAS solo se ejecuta automáticamente cuando no quedan elementos sin mapear.

## 8. Mapa europeo

El dashboard incluye un SVG original reconocible de Europa con España, Francia, Bélgica, Países Bajos y Alemania, una ruta, checkpoints y coche sincronizado con `currentStageId`. En escritorio solo se muestra permanentemente el label actual; los demás aparecen con hover/foco y existe una alternativa textual completa.

La ilustración no usa teselas, Google Maps, capturas ni recursos remotos. `prefers-reduced-motion` elimina animaciones no esenciales.

## 9. Dashboard

El dashboard muestra hero, selector Aprender/Operación real, continuidad, progreso de 72 lecciones y 12 etapas, mapa, etapa actual, accesos rápidos y acompañamiento. El prólogo se presenta como “Empieza aquí” y queda fuera del porcentaje.

El estado migrado real fue ensayado: 16/72 lecciones, 2/12 etapas y anchor actual conservado.

## 10. Móvil

Bajo 900 px desaparece la sidebar y aparece navegación inferior. Bajo 768 px la ruta europea se convierte en carretera vertical con paradas, escenas, país, estado y número de lecciones. El CTA de continuidad vuelve al flujo para que la bottom bar sea el único elemento persistente.

Se validaron 360×800, 390×844, 430×932, 768×1024, 900×1180, 1024×768, 1200×800, 1366×768, 1440×900 y el viewport solicitado 1920×1080. El servicio de captura limita el raster de 1920 a 1670 px; el breakpoint CSS XL sí quedó activo y esta limitación está documentada.

## 11. Etapas

Cada etapa dispone de hero cinematográfico, escena original, metadatos, progreso, checkpoint, lista de lecciones y herramientas asociadas. La etapa 00 tiene `kind: prologue` y `countsTowardProgress: false`; las otras 12 son `core`.

Las etapas no bloquean consulta: la progresión recomienda el siguiente paso, pero el alumno puede abrir cualquier lección.

## 12. Lecciones

El layout de lección ofrece breadcrumbs, cabecera, resumen esencial, explicación, visual, conceptos, checklist, ejemplo, error habitual, acción y comprobación. El aside es el único elemento sticky en desktop y sus tarjetas internas permanecen estáticas, evitando solapes.

El completado didáctico nunca afirma que exista una importación real. Los mensajes contractuales son:

- `HAS COMPLETADO LA RUTA.`
- `FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.`

El segundo solo se alcanza mediante el estado explícito de la operación real.

## 13. Herramientas

Se implementaron 17 destinos: Mi operación, Presupuesto inicial, Candidatos, Filtros y búsquedas, Analizador de anuncio, Preparador de preguntas, Comparador con España, Calculadora de coste total, Pasaporte documental, Plan A/B/C, Planificador de viaje, Inspección presencial, Hoja de pintura, Compra y salida, Vuelta, Carpeta España y Método 7 días.

Cada herramienta tiene icono propio y guarda únicamente datos de expediente; su finalización no incrementa el progreso de aprendizaje.

## 14. Respuestas

El Centro de respuestas contiene 16 FAQs y 16 entradas de respuesta trazables. La búsqueda global indexa 436 entradas entre lecciones, conceptos, herramientas, FAQs, glosario, recursos y fuentes. No genera asesoramiento inventado y enlaza al concepto/anchor real.

## 15. Landing

La landing comunica “Importa tu primer coche desde cero”, conserva el precio de 179 €, la ventana promocional y el checkout LIVE existente. “Método 7 días” aparece como método incluido, no como promesa principal de resultado.

La preview europea es SVG/HTML/CSS original y muestra 72 lecciones, 317 conceptos y 17 herramientas. El contador ya no denomina los 317 conceptos como respuestas, pasos o tareas.

## 16. Demo

El demo canjea un Bearer servidor por una cookie `HttpOnly` de corta duración; el token no se acepta en query string. Entrega 1 muestra de prólogo y 12 muestras de etapa, sin contenido operativo premium, sin escritura de estado, sin Blob ni descargas.

La interfaz muestra “Demo segura” también en móvil y contabiliza 0/12 pasos de muestra y 0/12 etapas, con “12 etapas + empieza aquí”.

## 17. Assets y licencias

Los nuevos iconos, mapa, escenas de lección y preview de landing son SVG/HTML/CSS originales del proyecto. No se añadieron binarios ni URLs remotas. `ASSET_LICENSES_V2.md` registra procedencia y límites de reutilización.

Las imágenes del PDF se usaron como referencia de auditoría, no se extrajeron al shell. El asset histórico `hero-studio-car.webp` conserva una tarea pendiente de documentación de procedencia; no fue creado ni modificado en esta fase.

## 18. Accesibilidad

La revisión cubre landmarks únicos, skip link válido antes y después del montaje, headings, breadcrumbs, foco visible, controles con nombre, objetivos táctiles, diálogos etiquetados, regiones live, alternativas del mapa, navegación por teclado y reduced motion.

Es una validación estática y visual. Antes de producción se recomienda repetir con NVDA/VoiceOver y zoom 200 % en preview autorizada.

## 19. Rendimiento

El build público contiene 57 archivos y 1.944.979 bytes. El programa privado pesa 1.722.160 bytes, por debajo del límite de 4 MiB, y solo se solicita tras sesión/entitlement. No se añadieron librerías de frontend ni assets remotos.

Queda pendiente medir Web Vitals y latencia real Redis/Blob/Resend en preview; no se simuló una cifra de producción.

## 20. Seguridad

Se validaron sesión rotada/revocable, códigos y magic links de un uso, hashes en Redis, rate limits, CSRF/origen, allowlist de `returnTo`, entitlement idempotente, tombstone de revocación, admin Bearer, Blob privado y demo de solo lectura.

`private-products/` está ignorado por Git y `.vercelignore`, tiene cero archivos trackeados y no se copia a `dist`. Se contrastaron 1.010 IDs y fragmentos premium contra el build público: cero coincidencias. Solo existe `.env.example`; el escaneo no encontró firmas de secretos.

Cambios de zona roja justificados:

- `content.js`: fallback local v2 y semántica correcta del demo;
- `security.js`: estado v2, migración controlada y arrays legacy hasta 500;
- `shell.js`: elimina `<main>` anidado y fija el destino inicial del skip link.

Sus hashes normalizados están congelados en tests.

## 21. Analytics

La instrumentación distingue vistas de etapa, sección, concepto, respuesta y visual; inicio/final de herramienta; cambio de modo; ruta móvil; aprendizaje completo y operación real completa. El allowlist de `academyTrack` impide enviar campos arbitrarios o PII.

## 22. Tests

Resultados finales:

| Suite | Resultado |
| --- | ---: |
| `npm run check` | PASS |
| Tests globales | 50/50 |
| QA de experiencia estricto | 42/42 |
| Tests dirigidos Academia/migración/experiencia | 36/36 |
| QA editorial | 13 etapas, 72 lecciones, 317 conceptos, 317 mappings |
| Auditoría PDF | 150/150 páginas |
| Uploader v2 dry-run | PASS, sin red |

## 23. Build

Lint revisó 214 archivos y 37 scripts. Typecheck pasó para API, frontend y scripts. El build regeneró `dist/` por allowlist y confirmó checkout LIVE. `git diff --check` no detectó errores.

El uploader v2 validó ID estable, schema 2, 13/72/317/317, 17 herramientas, 40 vídeos y 1.722.160 bytes sin abrir una conexión ni modificar Blob.

## 24. Capturas

Se generaron 28 PNG en `outputs/academia-fase2-captures/`: matriz responsive del dashboard y vistas desktop/móvil de landing, acceso, ruta, etapa, lección, herramientas, respuestas y demo.

Las capturas principales son `dashboard-1440x900.png`, `dashboard-390x844.png`, `landing-1440x900.png`, `lesson-1440x900.png`, `route-390x844.png`, `tools-390x844.png` y `demo-dashboard-390x844.png`.

## 25. Archivos modificados

Archivos trackeados modificados, agrupados:

- Config/build: `.env.example`, `.gitignore`, `.vercelignore`, `package.json`, `vercel.json`, `scripts/build-check.mjs`, `scripts/lint.mjs`.
- Fulfillment existente: `api/importa-7-dias.js`, `assets/importa-7-dias/{landing,thanks}.{css,js}`, `importa-en-7-dias/{index.html,gracias/index.html}`, `scripts/upload-importa-7-dias-product.ps1`, `tests/importa-7-dias.test.js`.
- Web pública/navegación: `index.html`, `go/index.html`, `academia/index.html`, `assets/academia.css`, `assets/site-config.js`, `assets/site.js`, `placasverdes/index.html`, `servicios/acompanamiento-matriculacion/index.html`, `robots.txt`, `sitemap.xml`.

No se descartó ni sobrescribió trabajo ajeno preexistente del worktree.

## 26. Archivos nuevos

Principales grupos nuevos:

- Acceso/API: `academia/acceso/`, `api/academy.js`, `api/_academy/{content,repository,security,shell}.js`.
- Frontend: `assets/academy-access.js`, `assets/academy-private.{js,css}`, `assets/academy/private/{icons,europe-map,lesson-visuals,migration}.js`.
- Operación: scripts de grant, revoke, backfill y upload v1/v2.
- QA: `tests/academy*.test.js`, runners editoriales/de experiencia y documentación de Academia.
- Privado/ignorado: 99 archivos en `private-products/academy/v2/`, incluidas 72 lecciones JSON, 13 etapas, conceptos, mappings, tools, vídeos, fuentes, builder y `dist/program-v2.json`.
- Auditoría privada: `private-products/academy/source-audit-2026.json` (150 páginas, 106.421 bytes).

## 27. Datos y vídeos pendientes

Los 40 vídeos están modelados como `planned` y no tienen URLs falsas. Para producirlos faltan grabación, edición, subtítulos, transcripción y hosting privado.

Antes de activar producción también faltan valores reales de entorno, carga del catálogo/recursos a Blob privado, identidad/URLs legales definitivas, validación de soporte y ejecución controlada del backfill de compradores anteriores.

## 28. Riesgos restantes

- Tasas, impuestos, tramos de CO₂, IVTM, ITV, CoC/ficha reducida, placas de exportación y canales DGT deben verificarse contra fuente vigente antes de ejecutar.
- Falta una prueba E2E en preview con Redis, Blob, Resend y concurrencia CAS reales.
- Falta auditoría con tecnología asistiva y Web Vitals reales.
- La procedencia del asset histórico `hero-studio-car.webp` debe documentarse antes de reutilizarlo en nuevos soportes.
- No se ha ejecutado migración de compradores ni se han enviado emails reales.

## 29. Pagos sin cambios

La Fase 2 no cambió Payment Link, Price ID, moneda, importe, cantidad ni reglas de validación de Stripe. Los tests confirman que solo un pago completo, del producto correcto y con firma válida puede conceder entitlement. El fallo del grant de Academia sigue siendo reintentable y no duplica el fulfillment del producto comprado.

El checkout LIVE se conserva, pero el despliegue debe permanecer bloqueado hasta completar datos legales y la checklist operativa indicada en la documentación.

## 30. Sin commit, push ni deploy

No se creó commit, no se hizo push, no se abrió PR, no se subió contenido a Blob y no se desplegó a Vercel. Todo permanece local en `agent/academy-importa-7-dias` y en los entregables ZIP/capturas de `outputs/`.

La siguiente acción autorizada debe ser una revisión humana del ZIP y del diff. Publicar requiere una instrucción separada y explícita.
