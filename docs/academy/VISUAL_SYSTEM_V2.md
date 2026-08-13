# Sistema visual v2 · Academia IvanImports

## Objetivo

Academia v2 convierte el programa en una ruta clara entre aprendizaje y operación real. La interfaz debe permitir reconocer en menos de dos segundos el viaje España → Francia → Benelux → Alemania → España, localizar la etapa actual y abrir una respuesta o herramienta sin recorrer un índice largo.

La implementación sigue siendo HTML, CSS y JavaScript ESM nativos. No añade framework, librerías de iconos, fuentes remotas ni dependencias de build.

## Principios

1. **Aprender no equivale a terminar una importación.** La vista `Aprender` mide 72 lecciones. `Operación real` exige estado matriculado y tres confirmaciones explícitas.
2. **El mapa es navegación, no decoración.** Países, ruta, coche, checkpoints y destino son elementos coherentes con el estado recibido.
3. **El contenido privado llega por API.** Los módulos públicos contienen componentes, iconos y geometría; nunca bodies de lecciones, el mapa legacy ni URLs internas de Blob.
4. **La herramienta empieza por una decisión visual.** Comparadores, coste y operación muestran síntesis antes de tablas o formularios extensos.
5. **Móvil tiene una ruta propia.** Bajo 768 px, el mapa se transforma en carretera vertical con escenas y tarjetas; no en una lista desktop comprimida.
6. **Accesibilidad sin modo alternativo oculto.** La navegación funciona con teclado, `details`, nombres accesibles, foco visible y alternativa textual ordenada del mapa.

## Paleta canónica

| Token | Valor | Uso |
| --- | --- | --- |
| Canvas | `#F2F7FD` | Fondo principal |
| Canvas suave | `#F7FAFE` | Superficies secundarias |
| Blanco | `#FFFFFF` | Tarjetas y paneles |
| Tinta | `#081C36` | Texto y escenas nocturnas |
| Primario | `#0C68F2` | CTA, etapa actual, progreso |
| Primario profundo | `#0752C8` | Hover y gradientes |
| Cian | `#12C4D8` | Ruta y señales |
| Teal | `#10B8AE` | Ruta ejecutada y estados operativos |
| Éxito | `#20B67A` | Confirmaciones reales |
| Aviso | `#F2B740` | Riesgo revisable |
| Peligro | `#EA6374` | Bloqueo o error |
| Violeta | `#8064D8` | Conceptos y conocimiento |
| Borde | `rgba(8, 28, 54, 0.10)` | Jerarquía de superficie |

El contraste no depende del color: cada estado incluye texto, número o icono.

## Tipografía y escala

- Familia del sistema: `Inter, Manrope, Segoe UI, system-ui`.
- Titular principal: `clamp(2.2rem, 4.2vw, 4.8rem)` en dashboard y hasta `6.4rem` en landing amplia.
- Cuerpo: 0.78–1.12 rem según densidad.
- Etiquetas: 0.54–0.74 rem, peso 800–900 y mayúsculas solo en eyebrows.
- Altura táctil mínima: 44 px.
- Icono base: 20 px; iconos dentro de botones/segmentos: 16.8 px. Ningún SVG hereda ancho libre del contenedor.

## Componentes estructurales

### Shell

- Sidebar clara de 248–270 px en escritorio.
- Topbar translúcida, buscador global `Ctrl/Cmd+K` y estado de autoguardado.
- Bottom bar fija con cinco destinos en tablet/móvil.
- El modo demo añade una insignia y elimina descargas privadas.

### Dashboard

- Hero con porcentaje, lecciones completadas y CTA de continuidad.
- Selector `Aprender / Operación real` persistido en preferencias.
- Vista de aprendizaje: mapa europeo, etapa actual, accesos rápidos y soporte.
- Vista real: expediente activo, timeline, candidatos, presupuesto y estado de cierre.

### Mapa europeo

`assets/academy/private/europe-map.js` contiene geometría SVG original de España, Portugal, Francia, Bélgica, Países Bajos, Luxemburgo, Alemania y países de contexto. No usa Google Maps, teselas ni imágenes externas.

- La posición del coche usa `progress.currentStageId`.
- Solo la etiqueta de la etapa actual permanece visible; las demás aparecen en `hover` o `focus-within` para evitar solapes en Benelux.
- Existe un `<ol>` accesible con las 13 paradas y su estado.
- En móvil, `renderMobileRoute()` crea escenas verticales con país, lecciones, duración y estado.
- Con `prefers-reduced-motion` o preferencia interna se desactivan pulsos y desplazamientos.

### Etapas y lecciones

- Cada etapa tiene hero cinematográfico, escena, progreso, lecciones, checkpoint y herramientas recibidas.
- Los siete patrones editoriales v2 cambian composición sin alterar contenido:
  - `NARRATIVE_ROUTE`
  - `VISUAL_DECODER`
  - `COMPARISON_LAB`
  - `GUIDED_CALCULATION`
  - `CONVERSATION_SIMULATOR`
  - `INSPECTION_WORKBENCH`
  - `PROCEDURE_TIMELINE`
- Las lecciones admiten secciones, visuales, ejemplos, decisiones, checklists, knowledge checks, conceptos, glosario y fuentes oficiales.
- Si un vídeo no tiene URL válida, no se dibuja hueco ni placeholder. Transcripción y captions aparecen solo cuando existen.

### Visuales editoriales

`assets/academy/private/lesson-visuals.js` transforma únicamente datos recibidos en comparaciones, timelines, tablas, funnels, cálculos, documentos anotados, inspecciones y blueprints. Toda figura incluye `figcaption`, texto alternativo editorial cuando existe y evento de interacción sin PII.

### Herramientas

Las 17 entradas canónicas quedan resueltas:

- Panel de operación y candidatos.
- Presupuesto, filtros, anuncio, preguntas, mercado y coste total.
- Documentos, Plan A/B/C, viaje e inspección.
- Mediciones de pintura, compra/salida y vuelta con componentes distintos.
- Carpeta España y Método 7 días.

Mercado y coste muestran primero barras/bloques; la tabla completa queda dentro de `details`. Operación agrupa sus campos en cuatro secciones plegables.

### Centro de respuestas

- `Ctrl/Cmd+K` busca etapas, 72 lecciones, 317 conceptos, FAQs, glosario, herramientas, recursos, fuentes y el `searchIndex` v2.
- Los conceptos abren la lección y su anchor.
- Un resultado vacío no genera una respuesta; remite a contenido o soporte.

## Estado v1/v2 y migración

- `normalizeProgram()` acepta stages con lessons anidadas (v1) o `lessonIds` globales (v2).
- v2 cuenta las 72 lecciones, incluido el prólogo; el indicador de etapas sigue mostrando 12 etapas más `Empieza aquí`.
- `legacyLessonMap` llega únicamente dentro del programa privado autenticado.
- Antes de renderizar se ejecutan `normalizeLegacyLessonMap`, `migrateAcademyStateV1ToV2` y `resolveLegacyDeepLink`.
- Si existe cualquier campo `migration.unmapped*`, el estado migrado se muestra en memoria pero el autoguardado se bloquea y aparece un aviso recuperable.

## Analytics sin PII

Los eventos solo aceptan IDs de catálogo, modo, viewport y tipo de contenido:

- `academy_stage_viewed`
- `academy_lesson_section_viewed`
- `academy_concept_opened`
- `academy_answer_opened`
- `academy_visual_interacted`
- `academy_tool_started`
- `academy_tool_completed`
- `academy_learning_route_completed`
- `academy_real_operation_completed`
- `academy_mode_changed`
- `academy_mobile_route_opened`

No se envían email, VIN, URL de anuncio, respuestas de formularios ni términos escritos en el buscador.

## Procedencia visual

Mapa, iconos y visuales son SVG/HTML/CSS originales. El registro completo está en `ASSET_LICENSES_V2.md`. No se añadieron activos binarios ni URLs de imagen remota en esta fase.
