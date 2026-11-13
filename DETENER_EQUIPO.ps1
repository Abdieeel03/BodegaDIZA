$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path '.env.equipo')) {throw 'No existe .env.equipo. El entorno de equipo aun no esta configurado.'}
& docker compose --env-file .env.equipo -f docker-compose.equipo.yml down
if ($LASTEXITCODE -ne 0) {throw 'No se pudieron detener los contenedores.'}
Write-Host 'Servicios detenidos. Los datos PostgreSQL y modelos ML siguen en sus volumenes.'
Write-Host 'No utilices docker compose down -v salvo que quieras borrar expresamente TODOS esos datos.'
