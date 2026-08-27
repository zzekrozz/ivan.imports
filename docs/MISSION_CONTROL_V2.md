# Mission Control V2 — informe técnico

## Auditoría inicial

Mission Control era una SPA privada sin framework de UI: HTML generado en servidor, CSS y módulos ESM de navegador sobre Node.js 22. Se despliega en Vercel y utiliza una única Vercel Function (`api/control.js`). Los datos viven como agregado JSON versionado en Upstash Redis mediante REST y escritura compare-and-swap. No hay ORM ni base de datos relacional.

La autenticación ya era independiente de la Academia: código privado validado en servidor, cookie firmada `HttpOnly`, `SameSite=Strict` y sujeto derivado de la sesión. El dominio ya incluía proyectos, Quest, completados, objetivos, Idea Vault, XP, nivel, racha, Main Quest, recurrencia básica e idempotencia. Había manifest, pero no service worker, Web Push ni jobs programados.

## Decisiones de arquitectura

- Se amplía `Quest`; no se crea una entidad `Task` paralela.
- El agregado sube a esquema 2 y se migra de forma perezosa al leerlo. Esto conserva proyectos, Quest, completados, ideas, XP y rachas sin una migración destructiva.
- Fecha local, hora opcional y timezone se conservan explícitamente. Cuando hay hora, `due_at` se deriva en UTC.
- Recurrencia, ocurrencias, overdue, resumen diario y scheduling de recordatorios viven en `assets/control/mission-schedule.js`, fuera de la UI.
- Un recordatorio define el offset relativo. Una entrega registra el intento real, su estado, snooze, cancelación o descarte.
- `getTodaySummary` es la fuente única para total, completadas, pendientes, vencidas y lista diaria; Main Quest no se duplica.
- Se mantiene el agregado Redis y su compare-and-swap. No se introduce infraestructura de pago ni un segundo almacén.

## Modelo y migración

Las Quest incorporan de forma compatible:

- `scheduled_date`, `scheduled_time`, `timezone` y `due_at`;
- prioridad `LOW`, `NORMAL` o `HIGH` (el legacy `CRITICAL` migra a `HIGH`);
- recurrencia `once`, `daily`, `weekly`, `monthly` o `interval` con configuración y fecha final;
- varios `reminders`, Main Quest, origen (`control`, `quick-add`, `mobile`) y `completed_at`;
- estados activos, en progreso, completados, archivados o cancelados.

El agregado añade `reminder_deliveries` y `preferences`, con timezone, presets básicos, estado de permisos y suscripciones Push. La normalización se ejecuta con el usuario autenticado, por lo que no confía en un `user_id` procedente del cliente.

## Recordatorios y entrega

1. La ocurrencia se calcula desde la regla recurrente y el timezone de la Quest.
2. La fecha/hora local se convierte a UTC.
3. Cada offset genera una clave de scheduling estable.
4. El dispatcher protegido por `CRON_SECRET` busca candidatos vencidos, envía Web Push y registra solo los que tuvieron al menos una entrega correcta.
5. Snooze conserva la hora original y establece `snoozed_until` sobre la entrega.
6. Cambiar fecha, hora, timezone, recurrencia o offsets cancela las entregas antiguas y recalcula las siguientes.
7. Completar o archivar cancela entregas futuras de esa ocurrencia.

Mientras la web está abierta existe una comprobación discreta cada minuto. La entrega con la web cerrada requiere Web Push y que el dispatcher sea invocado por un scheduler.

## Variables de entorno nuevas

```text
CONTROL_VAPID_PUBLIC_KEY=
CONTROL_VAPID_PRIVATE_KEY=
CONTROL_VAPID_SUBJECT=mailto:soporte@ivanimports.es
CRON_SECRET=
```

Las claves VAPID se pueden generar con `npx web-push generate-vapid-keys`. La clave privada y `CRON_SECRET` son exclusivamente de servidor. El cliente solo recibe la clave pública después de autenticarse.

## Garantía actual de notificaciones

El código implementa manifest, service worker, permiso contextual, PushSubscription, Web Push, limpieza de suscripciones expiradas y dispatcher seguro en:

```text
GET /api/control/reminders/dispatch
Authorization: Bearer <CRON_SECRET>
```

No se ha añadido un cron de alta frecuencia a `vercel.json` porque el plan de Vercel no está declarado en el repositorio. En Hobby, Vercel Cron solo permite una ejecución diaria y puede ejecutarla en cualquier momento de la hora, por lo que no sirve para recordatorios de minutos. Para entrega programada útil hay que configurar las cuatro variables y un scheduler con frecuencia compatible con el plan. Incluso entonces, Web Push está sujeto a las políticas de ahorro de batería y notificaciones del navegador/SO; no es una alarma de tiempo real garantizado.

## PWA

- Manifest específico, icono propio, colores Studio Nocturno y modo standalone.
- Service worker limitado al scope `/control/`.
- Se cachean únicamente archivos estáticos de la app; las rutas `/api/` y los datos personales nunca se cachean.
- Las notificaciones abren o enfocan Mission Control en la misión correspondiente.
- La instalación no altera el resto de IvanImports.

## Preparación Android

La lógica diaria y de scheduling está desacoplada de la interfaz. Una futura capa móvil dispone del contrato autenticado `GET /api/control/summary`, además de `state` y las operaciones idempotentes `quest.create`, `quest.complete`, `reminder.snooze` y sus equivalentes a través de `mutate`. Antes de publicar un cliente Android habrá que diseñar autenticación de dispositivo/token; la cookie privada actual sigue siendo deliberadamente web-only.

## Experiencia implementada

- Today con puntos, contador, Main Quest, horarios, vencidas, semana y proyectos.
- Quick Add en dos acciones, tipo Misión/Idea, `Q` y `Ctrl/Cmd + K`.
- Bottom sheet móvil y navegación inferior.
- Editor progresivo con proyecto, categoría, prioridad, estado, fecha, hora, reminders múltiples/personalizado, recurrencia, Main Quest, completar y archivar.
- Presets Normal e Importante preparados en preferencias para futura edición.
- Snooze de 15 minutos, una hora o intervalo personalizado, además de completar desde el aviso.
- UI optimista al completar y cancelación de reminders de la ocurrencia.

## Validación

Las pruebas cubren autenticación, aislamiento del propietario, summary móvil, autorización del dispatcher, envío y registro Push, timezone/DST, recurrence semanal/mensual/intervalo, overdue, contador sin duplicar Main Quest, offsets múltiples, cambio de hora, snooze, cancelación al completar, XP, historial e idempotencia.

También se revisaron manualmente escritorio y móvil: Today, navegación, Quick Add, persistencia local de prueba, edición, contador, FAB y bottom sheet.

## Limitaciones reales

- No hay entrega fiable con la web cerrada hasta configurar VAPID y un scheduler con frecuencia suficiente.
- No se implementa Android, widget ni overlay; solo contratos y dominio reutilizables.
- Los presets propios editables quedan preparados en el modelo, pero V2 expone los presets básicos y el selector personalizado.
- Web Push puede ser retrasado o bloqueado por el navegador/SO.
