# QA checklist

## Resultado local · 11 de agosto de 2026

- `npm run check`: lint (96 archivos), typecheck, 27/27 tests y build correctos.
- 698 rutas públicas/privadas y aliases directos respondieron sin 404 en el servidor de QA.
- Los 8 viewports exigidos se probaron sin scroll horizontal, controles visibles sin etiqueta ni errores de consola.
- Onboarding, guardado, progreso persistente, final al 100 %, búsqueda, candidato, soporte y calculadora se recorrieron en navegador.
- Upload de contenido, grant, revoke y backfill se validaron en `dry-run`, sin conexión ni mutación externa.
- Permanecen abiertos los controles legales, DPA/retención, credenciales de producción y los assets audiovisuales reales indicados abajo y en `ASSETS_NEEDED.md`.

## Contenido y privacidad

- [x] El JSON privado tiene `id: importa-tu-primer-coche`.
- [x] Existen 13 etapas, 317 pasos, al menos 10 herramientas y 40 vídeos.
- [x] Etapa 0 es `prologue` y no cuenta en progreso.
- [x] Cada `lessonId` existe una sola vez y cada paso enlaza anterior/siguiente.
- [x] Los seis tipos pedagógicos están presentes.
- [x] Todo bloque `oficial` referencia una fuente oficial enlazada.
- [x] Explicación, motivo, error y acción de cada lección están alineados con su título; ninguna hereda copy genérico de otra etapa.
- [x] `lesson-5-10` explica vuelo y transporte local sin mezclar liquidación fiscal u otras partidas.
- [x] `lesson-12-25` contiene exactamente el cierre final aprobado: “FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.”
- [x] Hechos sensibles usan `verify-before-use`.
- [x] Método 7 días no se presenta como garantía.
- [x] JSON premium y PDFs no aparecen en Git, `dist/`, sitemap ni rutas públicas.
- [x] La respuesta del programa no expone pathnames o URLs internas de Blob.
- [x] `docs/academy/content-source-map.json` no contiene cuerpos premium.

## Pago y entitlement

- [x] Webhook válido concede entitlement.
- [x] Repetición es idempotente.
- [x] Precio, moneda o estado incorrectos no conceden acceso.
- [x] Session ID falso no concede.
- [x] Guía/cuaderno actuales siguen disponibles.
- [x] Gracias y email muestran entrada a academia sin eliminar el fallback PDF.

## Acceso

- [x] Solicitud de email devuelve respuesta neutral.
- [x] Código válido crea sesión.
- [x] Código vencido, reutilizado o incorrecto falla sin filtrar datos.
- [x] Enlace mágico es de un solo uso.
- [x] Rate limit funciona para solicitud y verificación.
- [x] Cookie es HttpOnly, SameSite y Secure en producción.
- [x] Logout revoca sesión.
- [x] Return URL externa o no allowlisted se rechaza.
- [x] Sin entitlement devuelve 403 humano y ruta de recuperación.

## Progreso y estado

- [x] Completar/descompletar actualiza porcentaje de etapas 1-12.
- [x] “Continuar” abre el paso correcto.
- [x] Progreso persiste entre sesiones.
- [x] Conflicto de revisión no pisa estado más nuevo.
- [x] No se puede leer o escribir estado de otro subject.
- [x] Payload mayor de 256 KiB o con claves peligrosas se rechaza.
- [x] Máximo de candidatos y longitudes se valida.

## Herramientas

- [x] Mi operación crea, edita y conserva siguiente acción.
- [x] Candidatos mantienen Plan A/B/C.
- [x] Presupuesto y coste total distinguen estimado/confirmado/real.
- [x] Comparador no mezcla unidades sin advertencia.
- [x] Pasaporte documental admite todos los estados previstos.
- [x] Preguntas se agrupan y se copian sin inventar traducciones.
- [x] Inspección registra antes/después y no interpreta una cifra universal.
- [x] Carpeta España no produce una autoliquidación jurídica definitiva.
- [x] Calendario 7 días permite bloqueos y alternativas.

## Recursos

- [x] Comprador autorizado accede a `guide` y `workbook`.
- [x] No comprador recibe rechazo.
- [x] Identificadores distintos de `guide|workbook` se rechazan.
- [x] Caché, content-disposition y noindex son adecuados.
- [x] Enlace/pathname interno no aparece en HTML, logs o analítica.

## Legal, privacidad y retención

- [ ] Aviso legal, privacidad, cookies y condiciones tienen texto/URL e identidad fiscal aprobados; no están vacíos ni ocultos con checkout LIVE.
- [ ] Los enlaces legales son visibles y funcionan desde landing, checkout, acceso y área privada.
- [ ] La política de privacidad describe progreso, operación, candidatos, presupuesto, autenticación, soporte y proveedores realmente utilizados.
- [ ] La política de cookies coincide con cookies y analítica reales y el consentimiento se obtiene cuando corresponda.
- [ ] Existe una matriz aprobada de finalidad, base, categorías, destinatarios, conservación y borrado para el nuevo estado de Academia.
- [ ] DPA/subencargados y transferencias aplicables están revisados para hosting/Blob, Redis/KV, email, Stripe y analítica.
- [ ] Se ha probado el procedimiento de acceso, exportación, supresión y cierre sin borrar datos que deban conservarse legalmente ni retenerlos sin base.
- [ ] Los TTL de códigos, enlaces y sesiones coinciden con la política aprobada; estado, entitlement, auditoría y tombstones tienen ciclo de vida definido.
- [x] Logs, soporte y analítica no reciben VIN completo, documentos, email en claro, presupuesto detallado ni contenido de preguntas.

## Búsqueda

- [x] Encuentra pasos, glosario, respuestas y herramientas.
- [x] Teclado y focus funcionan en resultados.
- [x] Sin resultado muestra el copy honesto y pasos relacionados.
- [x] No envía VIN, email ni consulta completa a analítica.

## Responsive y accesibilidad

- [x] 360×800, 390×844, 430×932.
- [x] 768×1024, 1024×768.
- [x] 1366×768, 1440×900, 1920×1080.
- [x] Sin scroll horizontal.
- [x] Skip link y orden de headings correctos.
- [x] Navegación, nodos, checklists y diálogos funcionan por teclado.
- [x] Focus visible; Escape cierra y devuelve foco.
- [ ] Contraste WCAG 2.2 AA y estados no dependen solo del color.
- [x] `prefers-reduced-motion` desactiva movimiento no esencial.
- [ ] Vídeo futuro exige captions/transcript.

## Rendimiento

- [x] JSON privado por debajo de 4 MiB y sin lecciones duplicadas dentro de etapas.
- [x] Vídeos e imágenes se cargan de forma diferida.
- [x] No hay canvas o animación JS continua.
- [ ] CLS inferior a 0,05 en vistas clave.
- [x] No hay errores de consola.
- [ ] No hay solicitudes repetidas innecesarias (pendiente de medir en preview real con backend desplegado).

## Regresión

- [x] Landing LIVE y CTA de Stripe.
- [x] `/gracias/`, webhook, email y descargas.
- [x] Biblioteca pública `/academia/`.
- [x] Navegación, sitemap, robots y analytics existentes.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- [x] No se ha hecho commit, push ni deploy.
