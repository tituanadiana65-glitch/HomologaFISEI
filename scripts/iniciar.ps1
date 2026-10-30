# HomologaFISEI · arranque completo en Windows (lo ejecuta INICIAR.bat)
# 1) revisa Docker  2) pide la clave de la IA (Gemini, gratis) si falta  3) levanta todo
# 4) carga los 80 planes  5) prueba una homologación  6) abre la página
# Todo queda registrado en logs\inicio.log
$ErrorActionPreference = 'Continue'
chcp 65001 > $null  # acentos y símbolos bien en la ventana
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force logs | Out-Null
Start-Transcript -Path logs\inicio.log -Force | Out-Null

function Paso($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Paso 'Revisando Docker'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop no está encendido. Ábrelo, espera a que diga "Engine running" y vuelve a dar doble clic en INICIAR.bat' -ForegroundColor Yellow
  Stop-Transcript | Out-Null; Read-Host 'Enter para cerrar'; exit 1
}
Write-Host 'Docker funciona.'

Paso 'Clave de la IA gratuita (Gemini de Google)'
if (-not (Test-Path .env) -or -not (Select-String -Path .env -Pattern '^IA_PROVEEDOR=' -Quiet)) { Copy-Item .env.example .env -Force }
$envTexto = [IO.File]::ReadAllText((Resolve-Path .env))
$proveedor = if ($envTexto -match '(?m)^IA_PROVEEDOR=(\S+)') { $Matches[1] } else { 'gemini' }
if ($proveedor -ne 'ollama' -and $envTexto -notmatch '(?m)^IA_API_KEY=\S+') {
  Write-Host 'El agente usa Gemini de Google, que es gratis. Saca la clave aquí (inicia sesión con tu cuenta de Google):'
  Write-Host '   https://aistudio.google.com/apikey   ->  "Create API key"  ->  copia la clave (empieza con AIza...)' -ForegroundColor Yellow
  Start-Process 'https://aistudio.google.com/apikey'
  $clave = Read-Host 'Pega la clave con clic derecho y presiona Enter (o solo Enter para seguir sin ella)'
  if ($clave.Trim()) {
    $envTexto = $envTexto -replace '(?m)^IA_API_KEY=.*$', ('IA_API_KEY=' + $clave.Trim())
    [IO.File]::WriteAllText((Resolve-Path .env), $envTexto)
    Write-Host 'Clave guardada en .env (este archivo no se sube a GitHub).'
  } else { Write-Host 'Sin clave: los resultados saldrán "Pendiente" hasta que la pongas.' -ForegroundColor Yellow }
} else { Write-Host "Proveedor de IA: $proveedor (clave lista)." }

Paso 'Construyendo y levantando los servicios (la primera vez tarda varios minutos)'
docker compose up -d --build 2>&1 | ForEach-Object { "$_" }

Paso 'Esperando a que respondan'
$servicios = 'catalogo', 'reglas', 'agente'
$listos = $false
for ($i = 0; $i -lt 60 -and -not $listos; $i++) {
  $listos = $true
  foreach ($s in $servicios) {
    try { Invoke-RestMethod "http://localhost:3000/api/$s/health" -TimeoutSec 3 | Out-Null } catch { $listos = $false }
  }
  if (-not $listos) { Start-Sleep 5 }
}
docker compose ps 2>&1 | ForEach-Object { "$_" }
if (-not $listos) {
  Write-Host 'Algún servicio no respondió. Últimos mensajes:' -ForegroundColor Red
  foreach ($s in 'ms-catalogo', 'ms-motor-reglas', 'ms-agente-ia', 'api-gateway') { Write-Host "--- $s"; docker compose logs $s --tail 30 2>&1 | ForEach-Object { "$_" } }
  Stop-Transcript | Out-Null; Read-Host 'Enter para cerrar'; exit 1
}
foreach ($s in $servicios) { Write-Host ("${s}: " + (Invoke-RestMethod "http://localhost:3000/api/$s/health" | ConvertTo-Json -Compress)) }

Paso 'Cargando los planes analíticos'
$carreras = Invoke-RestMethod http://localhost:3000/api/catalogo/carreras
$total = 0; foreach ($c in $carreras) { $total += $c._count.asignaturas }
if ($total -ge 80) { Write-Host "Ya hay $total asignaturas cargadas." }
elseif (Get-Command node -ErrorAction SilentlyContinue) { node scripts/cargar-planes.mjs 2>&1 | ForEach-Object { "$_" } }
else {
  # Sin Node.js instalado: se carga usando Node dentro de Docker
  docker run --rm -v "${PWD}:/app" -w /app -e GATEWAY=http://host.docker.internal:3000 node:22-alpine node scripts/cargar-planes.mjs 2>&1 | ForEach-Object { "$_" }
}
foreach ($c in (Invoke-RestMethod http://localhost:3000/api/catalogo/carreras)) { Write-Host ("{0}: {1} asignaturas" -f $c.nombre, $c._count.asignaturas) }

Paso 'Probando una homologación: Cálculo Integral TI -> Software'
$pedido = @{ codigoAprobada = 'UTA-FISEI-TI-MP-UB-02-01'; codigoNueva = 'UTA-FISEI-SF-MP-UB-02-02'; nota = 8.5; anio = 2025 } | ConvertTo-Json
try {
  $r = Invoke-RestMethod http://localhost:3000/api/agente/homologar -Method Post -ContentType 'application/json' -Body $pedido -TimeoutSec 180
  Write-Host ("Resultado: " + $r.resultado) -ForegroundColor Green
  $r.causas | ForEach-Object { Write-Host ("  {0} {1} {2}" -f $_.regla, $(if ($_.cumple) { 'OK ' } else { 'NO ' }), $_.causa) }
} catch { Write-Host ("La homologación falló: " + $_.Exception.Message) -ForegroundColor Red; docker compose logs ms-agente-ia --tail 30 2>&1 | ForEach-Object { "$_" } }

Paso 'Listo'
Write-Host 'Página: http://localhost:3000   ·   RabbitMQ: http://localhost:15672 (guest / guest)' -ForegroundColor Green
Stop-Transcript | Out-Null
Start-Process http://localhost:3000
Read-Host 'Enter para cerrar esta ventana'
