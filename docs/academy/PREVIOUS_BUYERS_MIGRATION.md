# Previous buyers migration

## Objetivo

Conceder a compradores anteriores el mismo entitlement del programa sin duplicar accesos ni imprimir emails completos. Esta tarea no ejecutó ningún backfill de producción.

## Scripts

- `scripts/academy-grant-entitlement.mjs`
- `scripts/academy-revoke-entitlement.mjs`
- `scripts/academy-backfill-entitlements.mjs`

Todos son dry-run por defecto. `--apply` no basta: cada acción requiere su confirmación específica y credenciales en variables de entorno.

## Grant manual

```powershell
node scripts/academy-grant-entitlement.mjs --email comprador@example.com
node scripts/academy-grant-entitlement.mjs --email comprador@example.com --apply --confirm-grant
```

## Revoke manual

```powershell
node scripts/academy-revoke-entitlement.mjs --email comprador@example.com
node scripts/academy-revoke-entitlement.mjs --email comprador@example.com --apply --confirm-revoke --reason reembolso
```

## Backfill

Entrada JSON:

```json
[
  { "email": "comprador@example.com", "paidAt": "2026-01-15T10:00:00.000Z" }
]
```

También se admite CSV/semicolon con `email` en la primera columna. El dry-run informa filas, emails válidos únicos, duplicados, inválidos, omitidos y una muestra enmascarada.

```powershell
node scripts/academy-backfill-entitlements.mjs --file .\compradores.json
```

Aplicar requiere:

```powershell
node scripts/academy-backfill-entitlements.mjs --file .\compradores.json --apply --confirm-backfill
```

## Variables administrativas

- `ACADEMY_ADMIN_API_URL=https://ivanimports.es/api/academy/admin/entitlement`: endpoint servidor protegido; no admite query ni credenciales embebidas.
- `ACADEMY_ADMIN_API_TOKEN`: token aleatorio de al menos 32 caracteres, solo en entorno servidor/operador.

Producción requiere `--confirm-production`. El backfill de producción añade un bloqueo doble: `ACADEMY_ALLOW_PRODUCTION_BACKFILL=YES` y `--confirm-backfill`. No se aceptan tokens en argumentos.

## Idempotencia y privacidad

- Se deduplican emails normalizados antes de conectar.
- Cada petición lleva una clave de idempotencia derivada de SHA-256, no el email.
- Logs muestran email enmascarado y referencia corta.
- Resultados distinguen `granted`, `skipped` y `errors`.
- El endpoint convierte email a subject HMAC e invoca `grantEntitlement` idempotente. Revoke invalida sesiones y deja un tombstone persistente hasta una reactivación administrativa explícita.

## Procedimiento recomendado

1. Exportar compradores desde la fuente autorizada.
2. Guardar el archivo fuera del repositorio.
3. Ejecutar dry-run y conciliar totales.
4. Probar contra entorno local/staging.
5. Aprobar endpoint, token, alcance y ventana.
6. Ejecutar lotes pequeños y revisar resultados.
7. Conservar un registro administrativo seguro.
8. Usar revoke solo con motivo documentado.
