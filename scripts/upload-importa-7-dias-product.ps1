[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$GuidePath,

    [Parameter(Mandatory = $true)]
    [string]$WorkbookPath,

    [string]$GuidePathname = "products/importa-7-dias/2026/guia-principal.pdf",
    [string]$WorkbookPathname = "products/importa-7-dias/2026/cuaderno-de-trabajo.pdf",
    [switch]$AllowOverwrite,
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-PrivatePdf {
    param([string]$Path, [string]$Label)

    $resolved = (Resolve-Path -LiteralPath $Path).Path
    $item = Get-Item -LiteralPath $resolved
    if ($item.Extension -ne ".pdf") {
        throw "$Label debe ser un archivo .pdf"
    }

    $stream = [System.IO.File]::OpenRead($resolved)
    try {
        $header = New-Object byte[] 5
        [void]$stream.Read($header, 0, 5)
        if ([System.Text.Encoding]::ASCII.GetString($header) -ne "%PDF-") {
            throw "$Label no tiene una cabecera PDF valida"
        }
    }
    finally {
        $stream.Dispose()
    }

    return $item
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList
    )

    $previousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell can wrap ordinary native stderr as NativeCommandError
        # when the global preference is Stop. Use the real process exit code.
        $ErrorActionPreference = "Continue"
        $output = & $FilePath @ArgumentList 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output = $output.Trim()
    }
}

if (-not $env:BLOB_READ_WRITE_TOKEN) {
    throw "Falta BLOB_READ_WRITE_TOKEN en el entorno. El script nunca acepta el token como argumento."
}

$guide = Resolve-PrivatePdf -Path $GuidePath -Label "La guia"
$workbook = Resolve-PrivatePdf -Path $WorkbookPath -Label "El cuaderno"
$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
$prefix = "products/importa-7-dias/2026/"

# Force read-write-token authentication so a VERCEL_OIDC_TOKEN left by
# `vercel env pull` cannot create an inconsistent OIDC/BLOB_STORE_ID pair.
$preflight = Invoke-NativeCapture -FilePath $npx -ArgumentList @(
    "vercel", "blob", "list",
    "--prefix", $prefix,
    "--limit", "10",
    "--rw-token", $env:BLOB_READ_WRITE_TOKEN,
    "--no-color"
)
if ($preflight.ExitCode -ne 0) {
    throw "No se pudo validar el Blob store con BLOB_READ_WRITE_TOKEN. $($preflight.Output)"
}
if ($preflight.Output -notmatch "(?i)\.private\.blob\.vercel-storage\.com") {
    throw "Operacion cancelada: el store asociado al token no se identifica como PRIVATE."
}

Write-Host "Store y credencial verificados mediante acceso privado." -ForegroundColor Green
Write-Host ("Guia: {0:N2} MiB -> {1}" -f ($guide.Length / 1MB), $GuidePathname)
Write-Host ("Cuaderno: {0:N2} MiB -> {1}" -f ($workbook.Length / 1MB), $WorkbookPathname)

if ($DryRun) {
    Write-Host "Dry-run correcto: no se ha subido ni sobrescrito ningun objeto." -ForegroundColor Green
    return
}

if (-not $Force) {
    $confirmation = Read-Host "Escribe SUBIR para continuar"
    if ($confirmation -cne "SUBIR") {
        throw "Subida cancelada sin modificar el almacenamiento."
    }
}

function Send-PrivateBlob {
    param([System.IO.FileInfo]$File, [string]$Pathname)

    $arguments = @(
        "vercel", "blob", "put", $File.FullName,
        "--pathname", $Pathname,
        "--content-type", "application/pdf",
        "--access", "private",
        "--multipart", "true",
        "--rw-token", $env:BLOB_READ_WRITE_TOKEN,
        "--no-color"
    )
    if ($AllowOverwrite) { $arguments += @("--allow-overwrite", "true") }

    $upload = Invoke-NativeCapture -FilePath $npx -ArgumentList $arguments
    if ($upload.ExitCode -ne 0) {
        throw "Fallo la subida privada de $($File.Name). $($upload.Output)"
    }
    if ($upload.Output) { Write-Host $upload.Output }
}

Send-PrivateBlob -File $guide -Pathname $GuidePathname
Send-PrivateBlob -File $workbook -Pathname $WorkbookPathname

Write-Host "Subida privada completada. No se ha copiado ningun PDF al repositorio ni a /public." -ForegroundColor Green
