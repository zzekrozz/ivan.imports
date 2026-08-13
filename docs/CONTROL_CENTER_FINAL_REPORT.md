# IvanImports · Control Center público

Fecha de cierre: 13 de agosto de 2026.

## Resultado

La web queda organizada como un único ecosistema público:

- home convertida en Control Center;
- IvanImports Academy gratuita, sin registro y con progreso local;
- oportunidades editoriales y educativas;
- directos con estado vacío honesto cuando no hay agenda confirmada;
- 17 herramientas integradas;
- cinco servicios PRO activos con precios centralizados;
- páginas SEO estáticas y sitemap generado;
- rutas antiguas con redirecciones permanentes.

La Academia conserva exactamente 13 etapas, 72 lecciones, 317 conceptos y 17 herramientas. El prólogo no se contabiliza como una de las 12 etapas de progreso.

## Contenido y publicación

- 13 páginas estáticas de etapa.
- 72 páginas estáticas de lección.
- 19 páginas SEO de conceptos seleccionados.
- 17 páginas de herramienta.
- 5 páginas de servicio activas.
- 1 oportunidad publicada como caso educativo y no como vehículo en venta.
- 0 directos publicados sin fecha confirmada.
- 0 borradores incorporados al sitemap.

Servicios activos:

1. Consultoría: 30 min · 60 € / 60 min · 90 €, IVA incluido.
2. SubastasPRO: 99 € + IVA.
3. Puesta en marcha de subastas: 149 € + IVA.
4. Primera compra en subasta contigo: 397 € IVA incluido.
5. Primera Importación Contigo: 997 € IVA incluido.

## Seguridad y límites

- La experiencia pública no llama a sesión, entitlement, estado ni recursos privados.
- El progreso utiliza `ivanimports.academy.public-state.v2` en el dispositivo.
- Los PDF premium no están en `assets/` ni en `dist/`.
- La edición PDF muestra 19,99 € IVA incluido, pero su CTA permanece desactivado hasta disponer de configuración propia.
- El build comprueba secretos, variables privadas, promociones caducadas, referencias al mapa raster antiguo y enlaces internos sin destino.
- Formularios: revisión previa en el navegador, honeypot, consentimiento y apertura manual de WhatsApp; la web no persiste su contenido.
- La analítica elimina parámetros que puedan contener nombre, email, teléfono, mensaje, URL, VIN, documentos o presupuesto.

No se modificaron ni ejecutaron pagos, Stripe, Redis, Blob, Resend, entitlements o Production durante esta fase.

## QA final

| Control | Resultado |
|---|---:|
| Lint | 393 archivos · correcto |
| Typecheck | correcto |
| Tests | 86/86 |
| QA de experiencia | 42/42 · 0 blockers · 0 warnings |
| QA editorial | 13/72/317/317 · source audit de 150 páginas validado |
| Build | correcto |
| Páginas y enlaces internos | correcto |
| PDF premium en `dist/` | 0 |
| Capturas requeridas | 18/18 |
| Vistas con overflow horizontal | 0/18 |
| Errores o warnings de consola | 0 |
| `git diff --check` | correcto |

Validaciones funcionales dirigidas:

- búsqueda semántica «campo K» con respuesta de confianza alta, contexto y páginas fuente;
- mapa navegable con 12 etapas, 10 países, 4 macrozonas, alternativa textual y vehículo SVG sin marca;
- portada de Academia con un único H1 y onboarding opcional;
- formulario de consultoría con revisión previa, sin abrir WhatsApp ni enviar datos;
- responsive validado en 1440×900 y 390×844 para la matriz exigida.

## Pendientes que permanecen bloqueados por configuración real

- textos legales definitivos y datos identificativos del titular;
- Payment Link propio de la edición PDF;
- calendario real de directos;
- piloto de búsqueda supervisada;
- newsletter y afiliación.

Estas funciones permanecen desactivadas y no muestran promesas, plazas, enlaces o condiciones inventadas.

## Entrega

Las 18 capturas están en `outputs/control-center-qa/`. No se ha realizado commit, push ni deploy.
