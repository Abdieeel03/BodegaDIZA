# Solo consulta: valida insumos antes de compartir con el equipo.
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
Write-Host '=== RAMA ==='
& git branch --show-current
Write-Host '=== ARCHIVOS PARA DOCKER ==='
foreach ($file in @('docker-compose.equipo.yml','api/Dockerfile.equipo','frontend-sistema/Dockerfile.equipo','ml-service/Dockerfile.equipo','demo-db/10-restore.sh','README_EQUIPO_DEMO.md')) {
  if (Test-Path $file) { Write-Host "OK: $file" } else { Write-Warning "Falta: $file" }
}
Write-Host '=== BASE DEMO ==='
if (Test-Path 'demo-db/bodega_diza_test_demo.dump') {
  Write-Host 'Snapshot presente: antes de compartir, confirmar que los registros son ficticios/autorizados.'
} else { Write-Warning 'No hay snapshot exportado. Ejecutar CREAR_COPIA_DEMO.ps1 en el equipo de origen.' }
Write-Host '=== CSV NECESARIOS PARA MODELO NUEVO ==='
foreach ($file in @('ml-service/data/ventas.csv','ml-service/data/productos.csv','ml-service/data/proveedores.csv')) {
  if (Test-Path $file) { Write-Host "OK: $file" } else { Write-Warning "Falta: $file" }
}
Write-Host '=== ARCHIVOS PRIVADOS QUE YA RASTREA GIT ==='
$tracked=@(& git ls-files)
$bad=@($tracked | Where-Object { $_ -match '(^|/)(\.env($|\.)|.*\.(?:joblib|pkl|dump|backup)$)|(^|/)node_modules/' })
if ($bad.Count -gt 0) { $bad | ForEach-Object { Write-Warning "REVISAR: $_" } } else { Write-Host 'No se detectaron secretos habituales rastreados. Esto NO reemplaza revisar el contenido de los cambios.' }
Write-Host '=== ARCHIVOS PENDIENTES EN GIT ==='
& git status --short
Write-Host 'No se hizo git add, commit, push ni cambios a la base.'
