# QA visual v2 · Academia y landing

## Alcance verificado

- Shell privado, onboarding, dashboard, ruta, etapa, lección y búsqueda.
- Separación aprendizaje / operación real.
- 17 herramientas, respuestas, recursos, soporte y cuenta.
- Landing pública con copy canónico, precio de 179 €, ventana promocional y CTAs de checkout conservados.
- Contrato privado v2 real: 13 etapas, 72 lecciones, 317 conceptos, 17 herramientas, 40 FAQs/searchables combinados según el contrato y 317 aliases legacy.

## Matriz responsive

Los siguientes ocho perfiles tienen reglas explícitas y forman la matriz de aceptación:

| Perfil | Viewport | Criterio principal | Estado |
| --- | ---: | --- | --- |
| Escritorio XL | 1920 × 1080 | Mapa amplio, sidebar 270 px, sin líneas excesivas | PASS; viewport solicitado y breakpoint XL activo. El servicio de captura limita el raster a 1670 px de ancho |
| Escritorio | 1440 × 900 | Dashboard completo, iconos 20 px, mapa legible | PASS; captura real |
| Portátil | 1200 × 800 | Rail, cards y labels sin solape | PASS; captura real |
| Tablet horizontal | 1024 × 768 | Shell compacto y grids 2–3 columnas | PASS; captura real |
| Tablet vertical | 900 × 1180 | Bottom nav, etapa y lección a una columna | PASS; captura real |
| Móvil grande | 768 × 1024 | Cambio a ruta vertical propio | PASS; captura real |
| Móvil | 430 × 932 | Tarjetas táctiles, buscador compacto, sin overflow | PASS; captura real |
| Móvil estrecho | 360 × 800 | Segmento vertical y preview simplificada | PASS; captura real |

El agente raíz completó la validación con el navegador integrado, sin Playwright externo. Además de la matriz obligatoria se capturaron 390 × 844 y 1366 × 768. Se recorrieron dashboard, ruta, etapa, lección, herramientas, respuestas, acceso, landing y demo. Las capturas están en `outputs/academia-fase2-captures/`. En 1920 × 1080 la emulación CSS y el breakpoint de 1600 px se aplicaron, pero el servicio del navegador recortó el PNG devuelto a 1670 px; esta limitación queda registrada y no se disfraza como un raster nativo de 1920 px.

## Hallazgos visuales resueltos

1. **SVG sobredimensionados en botones.** `.academy-icon` queda fijado a 20 px y a 16.8 px dentro de botones, selector de modo y buscador.
2. **Etiquetas solapadas en Benelux/Alemania.** Solo la actual permanece visible; las demás aparecen al pasar o enfocar. La lista accesible sigue completa.
3. **Coche en el origen aunque el alumno estuviera en otra etapa.** Se eliminó una animación CSS que anulaba el `transform` del SVG y se pasa `progress.currentStageId` de forma explícita.
4. **Progreso v1 mostrado como 307/317.** El programa v2 real migra el estado y muestra lecciones sobre 72; el ensayo coordinado mostró 16/72.
5. **Mapa móvil como lista.** Sustituido por carretera vertical con escenas, markers, país, número de lecciones y estado.
6. **Mercado/coste table-first.** La síntesis visual aparece primero y el detalle editable se pliega.
7. **Herramientas de pintura/compra/vuelta vacías.** Implementadas como tres workbenches independientes y guardables.
8. **Dos barras persistentes en móvil.** El CTA de continuidad vuelve al flujo bajo 768 px; solo la bottom bar permanece fija.
9. **Slug v2 interpretado como alias legacy.** El bootstrap busca primero coincidencia exacta de slug/id v2 y solo resuelve legacy cuando no existe. Se comprobaron prefijos 06, 10, 11 y 12.

## Accesibilidad

- El skip link apunta primero al contenedor válido `#academy-app` y, tras montar la aplicación, al landmark `#academy-main`.
- Landmarks, headings y breadcrumbs conservan orden lógico.
- Todos los controles interactivos tienen nombre accesible y mínimo táctil de 44 px.
- El mapa SVG decorativo usa alternativa textual ordenada y cada nodo tiene `aria-label` con estado.
- Los conceptos, glosario, fuentes, knowledge checks y secciones avanzadas usan `details/summary`, sin interacción exclusiva por hover.
- El foco visible se conserva en navegación, CTAs y formularios.
- `prefers-reduced-motion` y la preferencia de cuenta detienen animaciones/transiciones relevantes.
- Los estados loading, error, empty, guardando, guardado y error de guardado usan texto y regiones live.
- Ningún estado depende solo de color.

## Contrato y seguridad

- El frontend no contiene bodies premium ni el mapa de 317 conceptos.
- `legacyLessonMap` se consume desde `/api/academy/program` después de sesión y entitlement.
- El modo demo no habilita descargas ni URLs privadas.
- Solo se aceptan fuentes oficiales `https` y recursos internos permitidos.
- Vídeos sin URL no muestran un falso error ni un hueco de producción.
- Si una migración tiene `unmapped*`, se bloquea el PUT automático y se ofrece revisión.

## Pruebas automáticas y estáticas

- `node --check` correcto para `academy-private.js` y los módulos de iconos, mapa, visuales y migración.
- Lint del repositorio: correcto en el pase ejecutado.
- Typecheck del repositorio: correcto en el pase ejecutado.
- Contrato v2 inspeccionado: 13/72/317/17 y 317 mappings.
- Migración ad hoc comprobada: agrupación parcial/completa, anchor actual y cero `unmapped` con mapa canónico.
- Runner de experiencia v2: 42/42 checks, cero blockers y cero warnings.
- Suite específica de migración/deep links: 11/11, incluida precedencia de slug exacto v2 sobre alias numérico legacy.
- `npm run check` final: lint sobre 214 archivos, typecheck correcto, **50/50 tests** y build público correcto.
- Auditoría editorial: 317 respuestas breves únicas, máximo 135 caracteres, sin truncados, duplicación con la explicación ni residuos de extracción.
- Escaneo final del build: 1.010 huellas privadas comprobadas y cero coincidencias en `dist/`.

## Checklist manual antes de deploy

- Repetir las ocho vistas si se cambia CSS, tipografía o estructura; la matriz de esta entrega ya fue recorrida y capturada.
- Probar teclado completo: sidebar, bottom bar, `Ctrl/Cmd+K`, resultados, `details`, formularios y cierre de diálogos.
- Verificar en etapa 03 que coche, label actual, CTA y estado usan el mismo `currentStageId`.
- Alternar `Aprender / Operación real`, recargar y comprobar persistencia.
- Completar una lección y una herramienta; confirmar autosave y eventos sin PII.
- Verificar que 100 % de aprendizaje no muestra una matrícula real.
- Confirmar operación real solo tras estado matriculado y las tres casillas finales.
- Probar demo: sin descargas, sin URLs privadas y sin contenido premium en el HTML inicial.
- Probar landing: CTA hero/header/sticky/offer conservan atribución y checkout; precio 179 € y promoción siguen visibles.
