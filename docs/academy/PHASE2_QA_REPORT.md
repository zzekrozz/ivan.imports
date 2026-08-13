# Informe QA — Academia IvanImports Fase 2

Fecha de revisión: 11 de agosto de 2026
Repositorio: `work/ivan.imports-publish`
Resultado final: **PASS — 42/42 comprobaciones de experiencia, 50/50 tests globales, 0 blockers, 0 warnings**

## Alcance

La auditoría cubre el catálogo privado v2 ensamblado, la experiencia privada, la landing pública de Academia, las rutas, los assets generados y el artefacto público `dist/`.

No modifica frontend, contenido privado, APIs, configuración de Vercel, `package.json` ni el proceso de build. Las comprobaciones automatizadas viven en:

- `scripts/academy-experience-qa-v2.mjs`
- `tests/academy-v2-experience.test.js`

## Resultado por área

| Área | Evidencia | Resultado |
|---|---:|---:|
| Estructura editorial | 13 etapas, 72 lecciones, 317 conceptos | PASS |
| Migración | 317 mappings, 317 aliases, 72 destinos, 13 etapas | PASS |
| Deep links | Slug v2 exacto antes de alias legacy; aliases antiguos conservados | PASS |
| Herramientas | 17 herramientas y 17 iconos específicos | PASS |
| Vídeos | 40 entradas previstas | PASS |
| Respuestas | 16 respuestas/FAQ conectadas al Centro de respuestas | PASS |
| Recursos | 20 entradas, con guía/cuaderno como entrega privada | PASS |
| Ruta visual | Mapa Europa con 13 nodos y ruta móvil con 13 paradas | PASS |
| Privacidad del build | Sin JSON privado ni huellas premium en `dist/` | PASS |
| Assets | Imports internos resolubles; sin cargas remotas nuevas | PASS |
| Accesibilidad estática | Landmarks, skip links, foco, reduced motion, labels y alt | PASS |
| Marca | Sin apariciones de MatriculaPRO | PASS |

## 13 / 72 / 317 sin convertir conceptos en tareas

El grafo editorial es consistente:

- las 13 etapas referencian exactamente las 72 lecciones, sin duplicados;
- las 72 lecciones referencian exactamente los 317 conceptos, sin duplicados;
- los 317 conceptos tienen una lección válida y un anchor único dentro de ella;
- los 317 mappings legacy apuntan a una lección, concepto y anchor reales;
- un slug exacto v2 se busca antes de aplicar la heurística de aliases antiguos;
- `/paso/6-04-*` continúa resolviendo al concepto legacy, mientras `06-04-*` abre su lección v2 exacta;
- las lecciones incluyen explicación redactada y checklist;
- el progreso de interfaz se calcula con `program.lessons`;
- los conceptos se presentan como elementos consultables `<details>` dentro de su lección y no tienen control de completado propio.

Por tanto, el alumno ve una ruta de 72 lecciones. Los 317 conceptos permanecen buscables y enlazables sin transformarse en 317 tareas.

## Aprendizaje frente a operación real

Las dos finalizaciones permanecen separadas en contenido, estado e instrumentación:

- `academy_learning_route_completed` depende del progreso de lecciones;
- `academy_real_operation_completed` exige estado `registered`/`matriculado` y confirmaciones explícitas de matrícula, carpeta final y cierre;
- el frontend toma los mensajes desde `completionSemantics.learning.message` y `completionSemantics.realOperation.message`;
- los copies finales quedan congelados como `HAS COMPLETADO LA RUTA.` y `FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.`;
- las 72 lecciones declaran que su completado no afirma una operación real;
- `completionSemantics.realOperation.neverInferFromLearningProgress` es `true`;
- la interfaz muestra paneles y CTAs distintos para aprendizaje y expediente real.

No se deduce una matrícula española por completar contenido.

## Experiencia visual y móvil

La prueba renderiza directamente los módulos puros del mapa:

- el mapa de escritorio produce un SVG europeo, 13 nodos accionables, labels accesibles y alternativa textual;
- la ruta móvil produce 13 enlaces verticales;
- a 768 px se oculta el mapa de escritorio y se activa la ruta móvil;
- existen ajustes adicionales hasta 360 px y para escritorio de 1600 px;
- mapa, escenas de etapa, visuales de lección e iconografía están conectados desde el frontend privado.

## Herramientas, respuestas y landing

El catálogo y la interfaz contienen 17 herramientas. Cada slug editorial tiene un icono específico y un destino operativo; `operation-dashboard` y `candidate-board` utilizan sus pantallas dedicadas.

El Centro de respuestas recibe preguntas con respuesta trazable y las presenta como elementos desplegables. La búsqueda indexa lecciones, conceptos, herramientas, respuestas, glosario, recursos y fuentes sin generar texto nuevo.

La landing mantiene tres conceptos separados:

1. biblioteca pública gratuita;
2. programa privado adquirido;
3. acceso para compradores existentes.

Los CTAs privados apuntan a rutas internas protegidas y el producto disponible no se describe como una plataforma futura.

## Accesibilidad estática

Se comprobaron:

- idioma de documento y un único H1 en landing;
- skip links con destino válido;
- ausencia de landmarks `<main>` anidados;
- foco visible;
- soporte `prefers-reduced-motion`;
- botones con `type` explícito;
- diálogos etiquetados;
- regiones `aria-live` para estados;
- alternativas `alt` en imágenes públicas;
- labels accesibles para nodos del mapa y controles de formularios.

Esta revisión es estática. Antes de publicar sigue siendo recomendable una pasada manual con teclado, zoom 200 %, VoiceOver/NVDA y los breakpoints principales usando una sesión de prueba autorizada.

## Privacidad y seguridad del artefacto público

La revisión de `dist/` confirma:

- no existen `program-v2.json`, `legacy-lesson-map.json`, `concept-map.json` ni `source-map.json`;
- no se copia ninguna ruta `private-products/`;
- no aparecen IDs ni fragmentos largos derivados de conceptos premium muestreados del catálogo privado; se excluyen únicamente los dos copies contractuales de finalización que la propia interfaz debe contener;
- los módulos públicos contienen lógica y shell, pero no el programa completo;
- los nuevos assets no importan módulos remotos ni usan `url(https://…)` o `fetch(https://…)`;
- la cadena MatriculaPRO no aparece en frontend, CSS, landing, shell, loader ni catálogo v2.

Las URLs oficiales que viven dentro del catálogo privado no se consideran assets remotos: se entregan únicamente tras autenticación y se tratan como referencias editoriales.

## Hallazgos detectados y resueltos fuera de ownership

Durante la auditoría se comunicaron tres incompatibilidades antes de generar el resultado final:

1. **P0 — ID de programa incompatible.** El ensamblado v2 utilizaba `importa-tu-primer-coche-v2`, mientras el backend exige el ID estable `importa-tu-primer-coche`. El catálogo fue corregido manteniendo la versión en `schemaVersion`/`version`.
2. **P1 — landmarks anidados.** El shell servidor utilizaba `<main id="academy-app">` y el frontend inyectaba otro `<main id="academy-main">`. El contenedor exterior se cambió a `<div>` y el skip-link inicial quedó resoluble.
3. **P0 — colisión entre slug v2 y alias legacy.** El slug v2 `06-04-*` podía interpretarse como el antiguo `lesson-6-04` y abrir otra lección. El bootstrap ahora comprueba primero IDs/slugs exactos v2 y solo después utiliza `resolveLegacyDeepLink`; el alias `/paso/6-04-*` permanece operativo.

Ambos controles forman parte del runner y volverán a fallar si reaparece la regresión.

## Ejecución

Auditoría legible:

```powershell
node scripts/academy-experience-qa-v2.mjs
```

Salida para automatización:

```powershell
node scripts/academy-experience-qa-v2.mjs --json
```

Tratar también P2 como fallo:

```powershell
node scripts/academy-experience-qa-v2.mjs --strict
```

Pruebas de regresión:

```powershell
node --test tests/academy-v2-experience.test.js
```

En un checkout público sin `private-products/` o antes de generar `dist/`, las pruebas privadas correspondientes se omiten. El runner permite auditorías parciales explícitas con `--public-only` y `--no-dist`; para el cierre de release deben ejecutarse sin esas opciones.

## Validación final coordinada

- `npm run check`: lint de 214 archivos, typecheck, 50/50 tests y build público correctos.
- `academy-content-qa-v2`: 13/72/317/317, 72 visuales, 72 ejemplos, 40 vídeos planificados y auditoría de 150 páginas.
- `academy-experience-qa-v2 --strict`: 42/42, sin P0/P1/P2.
- Uploader v2 en `--dry-run`: 1.722.160 bytes validados, sin abrir red ni modificar Blob.
- Matriz visual real: 1920, 1440, 1200, 1024, 900, 768, 430 y 360 px, más controles a 1366 y 390 px.
- Flujo real recorrido en navegador: landing, acceso, dashboard, ruta, etapa, lección, herramientas, respuestas y demo segura.
- Privacidad: 57 archivos en `dist/`; 1.010 IDs y fragmentos privados contrastados, con cero coincidencias.
- `private-products/` continúa ignorado por Git y Vercel y no tiene archivos trackeados.

## Riesgo residual

El runner demuestra integridad estructural y ausencia de fugas conocidas. No sustituye:

- una prueba E2E en navegador contra Redis/Blob reales;
- una repetición visual tras futuros cambios de CSS o tipografía;
- una auditoría WCAG con tecnología asistiva;
- validación de latencia, fallos de red y concurrencia CAS en un entorno preview;
- revisión humana final del contenido legal/fiscal mutable contra sus fuentes oficiales.

Estos puntos son validación previa a publicación; no constituyen blockers del artefacto estático revisado.
