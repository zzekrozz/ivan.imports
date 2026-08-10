# Importa tu coche en 7 días · operación segura

Este documento describe el flujo implementado y el procedimiento de activación. El checkout público continúa bloqueado con `checkoutEnabled: false`.

## Arquitectura

1. La landing obtiene el único Payment Link público desde `assets/importa-7-dias/config.js`. Conserva `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `ref`.
2. Stripe redirige a `/importa-en-7-dias/gracias/?session_id={CHECKOUT_SESSION_ID}`, pero la página no da por válida la compra.
3. Stripe llama por separado a `POST /api/stripe-importa-7-dias`. La función lee el cuerpo raw, verifica HMAC, recupera la sesión desde Stripe y valida Payment Link, Price ID, modo, EUR, 17.900 céntimos, una unidad y `payment_status=paid`.
4. Upstash Redis guarda el pedido y un lock de 90 segundos. El Checkout Session ID es la clave durable; el Event ID identifica el intento.
5. Resend envía un único email HTML/texto con una Idempotency-Key estable. Una respuesta negativa deja el pedido en `failed` y fuerza reintento. Una respuesta de red ambigua conserva `sending` y reintenta con la misma clave dentro de 23 horas; después pasa a `needs_review` para no arriesgar un duplicado.
6. Los dos PDF viven en un Vercel Blob store privado. El correo contiene enlaces HMAC de 7 días vinculados individualmente a `guide` o `workbook`. El endpoint valida recurso, firma, caducidad y pedido `delivered` en Redis y transmite el Blob sin revelar su URL.
7. `order-status` vuelve a consultar Stripe, devuelve solo estado, email enmascarado, elegibilidad y fin del bonus. Nunca devuelve teléfono, email completo ni enlaces de descarga.
8. La entrega depende del webhook, no de que el comprador visite la página de gracias.

## Rutas

- `POST /api/stripe-importa-7-dias`: webhook.
- `POST /api/importa-7-dias/order-status`: estado mínimo para la página de gracias.
- `GET /api/importa-7-dias/download`: descarga privada firmada.
- `POST /api/importa-7-dias/reissue`: reemisión manual autenticada.

## Variables

Obligatorias para entrega:

    STRIPE_SECRET_KEY
    STRIPE_WEBHOOK_SECRET
    STRIPE_IMPORTA_7_DIAS_PAYMENT_LINK_ID
    STRIPE_IMPORTA_7_DIAS_PRICE_ID
    STRIPE_IMPORTA_7_DIAS_EXPECTED_AMOUNT=17900
    RESEND_API_KEY
    RESEND_FROM_EMAIL
    UPSTASH_REDIS_REST_URL
    UPSTASH_REDIS_REST_TOKEN
    BLOB_READ_WRITE_TOKEN
    IMPORTA_7_DIAS_DOWNLOAD_SIGNING_SECRET
    IMPORTA_7_DIAS_BASE_URL=https://ivanimports.es

Necesarias según función:

    RESEND_IMPORTA_7_DIAS_SEGMENT_ID
    RESEND_IMPORTA_7_DIAS_AUDIENCE_ID
    IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME=products/importa-7-dias/2026/guia-principal.pdf
    IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME=products/importa-7-dias/2026/cuaderno-de-trabajo.pdf
    IMPORTA_7_DIAS_DOWNLOAD_TTL_SECONDS=604800
    IMPORTA_7_DIAS_SUPPORT_PHONE_E164
    IMPORTA_7_DIAS_ADMIN_EMAIL
    IMPORTA_7_DIAS_ADMIN_API_TOKEN

La integración Upstash de Vercel puede entregar `KV_REST_API_URL` y `KV_REST_API_TOKEN`; el backend los acepta como alias seguros de las dos variables `UPSTASH_*`. `RESEND_IMPORTA_7_DIAS_AUDIENCE_ID` es un alias de migración; en cuentas actuales debe usarse el Segment ID. Ningún secreto lleva prefijo `NEXT_PUBLIC`.

## Preparación local en PowerShell

Situarse en la raíz del proyecto:

    Set-Location "C:\Users\pc\Documents\Codex\2026-08-09\https-github-com-zzekrozz-ivan-imports\work\ivan.imports-production"

Instalar dependencias y ejecutar la batería:

    npm ci --ignore-scripts
    npm run check

Instalar o comprobar Stripe CLI:

    if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
      winget install --id Stripe.StripeCLI -e
    }
    stripe --version
    stripe login

Vincular Vercel y obtener variables de desarrollo:

    npx vercel login
    npx vercel link
    npx vercel env pull .env.local
    npx vercel dev --port 3000

En otra consola, escuchar solo los eventos utilizados:

    stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed --forward-to http://localhost:3000/api/stripe-importa-7-dias

Stripe mostrará un secreto `whsec_...` local. Guardarlo en `.env.local` como `STRIPE_WEBHOOK_SECRET`; no copiarlo a mensajes, Git o capturas.

## Producto y Payment Link de prueba

Estos comandos se ejecutan en modo test. Crean un producto y precio equivalentes sin tocar el precio ni la fiscalidad LIVE:

    $testProduct = (stripe products create -d "name=Importa tu coche en 7 días TEST" | ConvertFrom-Json)
    $testPrice = (stripe prices create -d "currency=eur" -d "unit_amount=17900" -d "product=$($testProduct.id)" | ConvertFrom-Json)
    $redirect = "http://localhost:3000/importa-en-7-dias/gracias/?session_id={CHECKOUT_SESSION_ID}"
    $testLink = (stripe payment_links create -d "line_items[0][price]=$($testPrice.id)" -d "line_items[0][quantity]=1" -d "after_completion[type]=redirect" -d "after_completion[redirect][url]=$redirect" | ConvertFrom-Json)
    $testProduct | Select-Object id,name
    $testPrice | Select-Object id,unit_amount,currency
    $testLink | Select-Object id,url,active

Colocar temporalmente en `.env.local`, nunca en el frontend:

    STRIPE_IMPORTA_7_DIAS_PAYMENT_LINK_ID=<id plink_ test>
    STRIPE_IMPORTA_7_DIAS_PRICE_ID=<id price_ test>

Abrir `$testLink.url` y pagar con los datos de prueba oficiales:

    Tarjeta: 4242 4242 4242 4242
    Caducidad: cualquier fecha futura
    CVC: tres cifras
    Código postal: cualquier valor válido

La página debe pasar de comprobando a confirmada, el listener debe responder 2xx y el correo debe contener dos enlaces privados funcionales.

Para QA visual sin llamar a Stripe ni cargar analítica externa:

    node scripts/serve-static.mjs --port=4173

Abrir solo en local `http://127.0.0.1:4173/importa-en-7-dias/gracias/?qa_state=confirmed`. El parámetro de QA se ignora fuera de `localhost`/`127.0.0.1` y se elimina enseguida de la barra de direcciones.

## Pruebas de webhook e idempotencia

La batería local cubre firma válida/manipulada/caducada, producto incorrecto, deadline exacto, 14 días, token manipulado/caducado, pago pendiente, email fallido, idempotencia y Blob privado:

    npm test

Para reenviar un evento real de test a un endpoint de test ya registrado en Stripe:

    $eventId = Read-Host "Event ID de test (evt_...)"
    $endpointId = Read-Host "Webhook endpoint ID de test (we_...)"
    stripe events resend $eventId --webhook-endpoint=$endpointId

Comprobar en Resend que el mismo Checkout Session ID conserva un solo email de entrega. La segunda respuesta del webhook debe indicar `duplicate: true`.

Session ID inválido:

    $body = @{ session_id = "cs_test_invalid" } | ConvertTo-Json
    try {
      Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/importa-7-dias/order-status" -ContentType "application/json" -Body $body
    } catch {
      $_.Exception.Response.StatusCode.value__
    }

Caída temporal conocida de email:

1. En un entorno de test, usar una clave Resend deliberadamente inválida.
2. Completar la compra test: el webhook debe responder 500 y Redis no debe quedar en `delivered`.
3. Restaurar la clave válida y reiniciar `vercel dev`.
4. Reenviar el mismo Event ID. Debe entregar una vez y marcar `delivered`.

El caso posterior al deadline y el segundo exacto del límite se prueban de forma determinista con:

    npm test -- --test-name-pattern="deadline"

## Vercel Blob privado

Crear el store desde el proyecto vinculado:

    npx vercel blob create-store ivanimports-products --access private

El token debe estar ya en la variable de entorno, no en el historial:

    $secureBlobToken = Read-Host "BLOB_READ_WRITE_TOKEN" -AsSecureString
    $blobTokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureBlobToken)
    try {
      $env:BLOB_READ_WRITE_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($blobTokenPtr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($blobTokenPtr)
    }

Subir por primera vez los originales privados:

    .\scripts\upload-importa-7-dias-product.ps1 `
      -GuidePath "C:\Users\pc\Downloads\IMPORTA-7-DIAS-FINAL-2026.pdf" `
      -WorkbookPath "C:\Users\pc\Downloads\CUADERNO-IMPORTA-7-DIAS-FINAL-2026.pdf"

Validar credencial, privacidad, cabeceras y tamaños sin subir ni sobrescribir:

    .\scripts\upload-importa-7-dias-product.ps1 `
      -GuidePath "C:\Users\pc\Downloads\IMPORTA-7-DIAS-FINAL-2026.pdf" `
      -WorkbookPath "C:\Users\pc\Downloads\CUADERNO-IMPORTA-7-DIAS-FINAL-2026.pdf" `
      -DryRun -Force

Reemplazar una versión conservando los pathnames:

    .\scripts\upload-importa-7-dias-product.ps1 `
      -GuidePath "C:\ruta\nueva-guia.pdf" `
      -WorkbookPath "C:\ruta\nuevo-cuaderno.pdf" `
      -AllowOverwrite

El script fuerza autenticación `--rw-token` para no mezclar OIDC con `BLOB_STORE_ID`, valida cabecera PDF, exige un dominio privado, usa subida multipart con `--access private` y pide escribir `SUBIR`. `-DryRun` no modifica el store. No copia archivos al proyecto.

## Upstash Redis

Crear una base Redis durable desde la integración de Vercel/Upstash, conectarla a Development, Preview y Production, y mapear:

    UPSTASH_REDIS_REST_URL
    UPSTASH_REDIS_REST_TOKEN

Las claves duran cinco años. No activar un modo de solo caché: el estado del pedido y el lock son parte de la garantía de entrega.

## Resend

1. Verificar el dominio remitente de IvanImports.
2. Configurar `RESEND_FROM_EMAIL` como remitente automático del dominio verificado, por ejemplo `IvanImports <no-reply@ivanimports.es>`.
3. Crear un Segment exclusivo llamado `Compradores · Importa tu coche en 7 días`.
4. Crear las propiedades de contacto de texto: `product_slug`, `purchased_at`, `bonus_eligible`, `support_expires_at`, `stripe_checkout_session_id` y `general_marketing_consent`.
5. Guardar el Segment ID en `RESEND_IMPORTA_7_DIAS_SEGMENT_ID`.
6. No usar ese segmento en campañas generales. El código marca `general_marketing_consent=false`; el alta del contacto es secundaria y nunca bloquea la entrega.

Asunto: “Ya tienes acceso a Importa tu coche en 7 días”. Se envían HTML y texto plano sin `Reply-To`; el contenido indica expresamente que el buzón no admite respuestas. No se habilita “Enable Receiving” en Resend.

## Variables en Vercel sin mostrarlas

El CLI pide cada valor de forma interactiva; no escribir valores en el comando:

    npx vercel env add STRIPE_SECRET_KEY production
    npx vercel env add STRIPE_WEBHOOK_SECRET production
    npx vercel env add STRIPE_IMPORTA_7_DIAS_PAYMENT_LINK_ID production
    npx vercel env add STRIPE_IMPORTA_7_DIAS_PRICE_ID production
    npx vercel env add STRIPE_IMPORTA_7_DIAS_EXPECTED_AMOUNT production
    npx vercel env add RESEND_API_KEY production
    npx vercel env add RESEND_FROM_EMAIL production
    npx vercel env add RESEND_IMPORTA_7_DIAS_SEGMENT_ID production
    npx vercel env add UPSTASH_REDIS_REST_URL production
    npx vercel env add UPSTASH_REDIS_REST_TOKEN production
    npx vercel env add BLOB_READ_WRITE_TOKEN production
    npx vercel env add IMPORTA_7_DIAS_GUIDE_BLOB_PATHNAME production
    npx vercel env add IMPORTA_7_DIAS_WORKBOOK_BLOB_PATHNAME production
    npx vercel env add IMPORTA_7_DIAS_DOWNLOAD_TTL_SECONDS production
    npx vercel env add IMPORTA_7_DIAS_BASE_URL production
    npx vercel env add IMPORTA_7_DIAS_SUPPORT_PHONE_E164 production
    npx vercel env add IMPORTA_7_DIAS_ADMIN_EMAIL production

Generar los dos secretos internos y enviarlos directamente a Vercel sin mostrarlos:

    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $generatedSecret = [Convert]::ToBase64String($bytes)
    $generatedSecret | npx vercel env add IMPORTA_7_DIAS_DOWNLOAD_SIGNING_SECRET production
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $generatedSecret = [Convert]::ToBase64String($bytes)
    $generatedSecret | npx vercel env add IMPORTA_7_DIAS_ADMIN_API_TOKEN production
    [Array]::Clear($bytes, 0, $bytes.Length)
    $generatedSecret = $null

No guardar estos valores en archivos ni copiarlos a mensajes.

## Webhook de producción

Antes de crearlo, confirmar en Stripe Dashboard que se está operando en LIVE y obtener los IDs internos del Payment Link y Price. La URL `buy.stripe.com` no reemplaza esos IDs.

Crear el endpoint LIVE sin imprimir el signing secret:

    $liveWebhookJson = stripe webhook_endpoints create --live `
      -d "url=https://ivanimports.es/api/stripe-importa-7-dias" `
      -d "enabled_events[]=checkout.session.completed" `
      -d "enabled_events[]=checkout.session.async_payment_succeeded" `
      -d "enabled_events[]=checkout.session.async_payment_failed"
    $liveWebhook = $liveWebhookJson | ConvertFrom-Json
    $liveWebhook | Select-Object id,url,status,enabled_events
    $liveWebhook.secret | npx vercel env add STRIPE_WEBHOOK_SECRET production
    $liveWebhook.secret = $null
    Remove-Variable liveWebhookJson,liveWebhook

No ejecutar este bloque hasta que el flujo test haya sido validado de extremo a extremo.

## Verificación y despliegue

Validación local:

    git status --short
    npm run check
    git ls-files "*.pdf"
    Get-ChildItem -Path . -Recurse -Filter *.pdf
    rg -n "sk_live_|whsec_|re_[A-Za-z0-9]{20,}|K[A]IROS K[R]ONOS" . -g "!node_modules/**" -g "!.git/**"

Build real de Vercel, todavía sin asignar el dominio:

    npx vercel build --prod

Solo después de la autorización final:

    npx vercel deploy --prod

Verificar producción:

    $paths = @("/", "/copart/", "/empieza/", "/consultoria/", "/importa-en-7-dias/", "/importa-en-7-dias/gracias/")
    foreach ($path in $paths) {
      $response = Invoke-WebRequest -Uri ("https://ivanimports.es" + $path) -MaximumRedirection 5
      [pscustomobject]@{ Path = $path; Status = $response.StatusCode; Bytes = $response.RawContentLength }
    }

El endpoint de estado sin sesión válida debe permanecer cerrado:

    $body = @{ session_id = "invalid" } | ConvertTo-Json
    try {
      Invoke-RestMethod -Method Post -Uri "https://ivanimports.es/api/importa-7-dias/order-status" -ContentType "application/json" -Body $body
    } catch {
      $_.Exception.Response.StatusCode.value__
    }

## Acompañamiento

La elegibilidad se calcula con el timestamp confirmado por Stripe. El límite inclusivo es `2026-08-16T23:59:59+02:00`. El fin es exactamente ese timestamp de pago más 14 × 24 horas. El teléfono y el enlace precompletado se construyen en servidor y solo aparecen dentro del email de una compra elegible. La página pública nunca recibe el número.

## Checklist previo a activar el checkout

- Compra completa en Stripe TEST.
- Firma del listener real aceptada y firma manipulada rechazada.
- Payment Link y Price ID de test verificados.
- Email HTML/texto recibido; Reply-To probado.
- Ambos enlaces descargan desde Blob privado y caducan.
- Reenvío del mismo evento no crea segundo email ni segundo contacto.
- Fallo temporal de Resend deja 500 y después se recupera.
- Compra en el deadline y segundo posterior cubiertos por tests.
- Página de gracias revisada en 390 px y 1440 px.
- Rutas existentes devuelven 200.
- Ningún PDF ni secreto dentro del repositorio.
- Ninguna referencia a la marca ajena prohibida.
- Solo entonces cambiar `checkoutEnabled` a `true`, volver a ejecutar `npm run check` y solicitar autorización de commit/push.
