# Arranque de cuatro servicios para la demo del equipo; no modifica la BD TEST original.
[CmdletBinding()]
param([switch]$OmitirEntrenamiento, [switch]$SoloConfigurar)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$compose = 'docker-compose.equipo.yml'
$envFile = '.env.equipo'
$seed = '.\demo-db\bodega_diza_test_demo.dump'
foreach ($file in @($compose, '.\api\Dockerfile.equipo','.\frontend-sistema\Dockerfile.equipo','.\ml-service\Dockerfile.equipo')) {
  if (-not (Test-Path $file)) { throw "Falta $file. Instala primero el paquete de equipo." }
}
if (-not (Test-Path $seed -PathType Leaf) -or (Get-Item $seed).Length -lt 1000) {
  throw "Falta la copia de prueba $seed. El responsable debe exportarla con .\CREAR_COPIA_DEMO.ps1 y compartirla por un canal autorizado."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop no esta disponible.' }
& docker info --format '{{.ServerVersion}}' 1>$null 2>$null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no responde. Inicia Docker Desktop.' }

function New-Secret([int]$size=32) {
  $bytes=New-Object byte[] $size
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
}
if (-not (Test-Path $envFile)) {
  $db=New-Secret 24
  $jwtBytes=New-Object byte[] 32
  $jwtRng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $jwtRng.GetBytes($jwtBytes) } finally { $jwtRng.Dispose() }
  $jwt=[Convert]::ToBase64String($jwtBytes)
  $pass=New-Secret 18
  @"
TEAM_DB_PORT=5543
TEAM_DB_PASSWORD=$db
TEAM_API_PORT=8081
TEAM_ML_PORT=8002
TEAM_WEB_PORT=5173
TEAM_JWT_SECRET=$jwt
TEAM_ADMIN_EMAIL=admin.equipo@bodegadiza.local
TEAM_ADMIN_PASSWORD=$pass
"@ | Set-Content -Encoding ASCII $envFile
  Write-Host 'Archivo local .env.equipo generado con contrasenas aleatorias. NUNCA lo subas a GitHub.'
} else { Write-Host 'Se mantiene el archivo .env.equipo existente; no se regeneran las contrasenas.' }
$vars=@{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $vars[$matches[1]]=$matches[2] }
}
$mlPort=$vars['TEAM_ML_PORT']; if (-not $mlPort) {$mlPort='8002'}
$webPort=$vars['TEAM_WEB_PORT']; if (-not $webPort) {$webPort='5173'}
$apiPort=$vars['TEAM_API_PORT']; if (-not $apiPort) {$apiPort='8081'}
if ($SoloConfigurar) {
  Write-Host 'Configuracion creada/revisada en .env.equipo. Edita los puertos si ya los utiliza otro programa; luego ejecuta .\INICIAR_EQUIPO.ps1 sin parametros.'
  exit 0
}

Write-Host 'Construyendo/iniciando los servicios (puede requerir descargar imagenes por primera vez)...'
& docker compose --env-file $envFile -f $compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose no pudo iniciar los servicios. Revisa docker compose ps/logs.' }

if (-not $OmitirEntrenamiento) {
  $mlBase="http://localhost:$mlPort"
  $ready=$false
  foreach ($i in 1..50) {
    try { $h=Invoke-RestMethod -Uri "$mlBase/health" -TimeoutSec 3; if ($h.status -eq 'ok') {$ready=$true;break} } catch {}
    Start-Sleep -Seconds 3
  }
  if (-not $ready) { throw "FastAPI no respondio en $mlBase. Revisa docker compose -f $compose logs ml" }
  $hasModel=$false
  try { $null=Invoke-RestMethod -Uri "$mlBase/trainings/latest/predictions" -TimeoutSec 10; $hasModel=$true } catch {}
  if (-not $hasModel) {
    $dir = Join-Path $PSScriptRoot 'ml-service\data'
    $files = @('ventas.csv','productos.csv','proveedores.csv')
    foreach ($f in $files) {
      if (-not (Test-Path (Join-Path $dir $f))) {
        throw "FastAPI no tiene modelo y falta ml-service/data/$f. Incluye los CSV de demostracion autorizados antes de continuar."
      }
    }
    Write-Host 'Entrenando un modelo de demostracion con los CSV del repositorio...'
    Push-Location $dir
    try {
      & curl.exe --fail-with-body -sS --max-time 900 -X POST "$mlBase/trainings" `
          -F 'sales_file=@ventas.csv' -F 'products_file=@productos.csv' -F 'suppliers_file=@proveedores.csv'
      if ($LASTEXITCODE -ne 0) { throw 'El entrenamiento de ML fallo. Revisa el log de ml.' }
    } finally { Pop-Location }
  } else { Write-Host 'ML: ya hay un modelo persistido; no se reentreno.' }
}
Write-Host ''
Write-Host 'BodegaDIZA para el equipo:'
Write-Host "  React:    http://localhost:$webPort"
Write-Host "  API:      http://localhost:$apiPort"
Write-Host "  ML:       http://localhost:$mlPort/health"
Write-Host '  Usuario:  revisa TEAM_ADMIN_EMAIL en .env.equipo'
Write-Host '  Clave:    revisa TEAM_ADMIN_PASSWORD en .env.equipo (no la compartas)'
Write-Host '  La copia de base es independiente; ni tu BD original ni el contenedor test original se tocan.'
Write-Host '  Si falla algo: docker compose --env-file .env.equipo -f docker-compose.equipo.yml logs -f --tail=100'
