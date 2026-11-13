# Crea una copia de la BD TEST local SIN exportar filas de public.usuarios.
# NO modifica datos ni contrasenas de la base de origen.
[CmdletBinding()]
param(
    [string]$SourceContainer = 'bodega_diza_postgres_test',
    [string]$SourceDatabase = 'bodega_diza_test'
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop debe estar instalado y activo.' }
if (-not (Test-Path '.\demo-db\10-restore.sh')) { throw 'Falta demo-db/10-restore.sh. Instala primero el paquete de equipo.' }
Write-Host "Origen: contenedor $SourceContainer / base $SourceDatabase"
Write-Warning 'Solo se debe compartir una base que contenga datos ficticios o autorizados. El dump excluye filas de public.usuarios, pero otras tablas pueden contener datos sensibles.'
$respuesta = Read-Host 'Confirma que NO hay datos reales de clientes/proveedores sin autorizacion para compartir (escribe CONFIRMO)'
if ($respuesta -cne 'CONFIRMO') { throw 'Exportacion cancelada. No se ha modificado la base.' }

$exists = (& docker container inspect --format '{{.State.Running}}' $SourceContainer 2>$null)
if ($LASTEXITCODE -ne 0 -or $exists.Trim() -ne 'true') {
    throw "El contenedor $SourceContainer no esta en ejecucion. Inicia tu PostgreSQL de pruebas."
}
$hasUsers = (& docker exec $SourceContainer psql -U postgres -d $SourceDatabase -Atc "SELECT to_regclass('public.usuarios') IS NOT NULL" 2>&1)
if ($LASTEXITCODE -ne 0 -or ($hasUsers -join '').Trim() -ne 't') {
    throw 'No se encontro public.usuarios en la base de origen o la consulta fallo. Se detuvo por seguridad.'
}
$targetDir = Join-Path $PSScriptRoot 'demo-db'
$target = Join-Path $targetDir 'bodega_diza_test_demo.dump'
if (Test-Path $target) {
    throw "Ya existe un snapshot en $target. No lo sobrescribiremos. Guardalo o cambiale el nombre manualmente si deseas una exportacion nueva."
}
$inside = '/tmp/diza_demo_' + [Guid]::NewGuid().ToString('N') + '.dump'
try {
    Write-Host 'Exportando esquema y datos de prueba, sin registros de usuarios...'
    & docker exec $SourceContainer pg_dump -U postgres -d $SourceDatabase --format=custom --no-owner --no-acl --exclude-table-data=public.usuarios -f $inside
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump fallo; no hay un respaldo completo.' }
    $toc = @(& docker exec $SourceContainer pg_restore --list $inside)
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore no puede leer el respaldo generado.' }
    if ($toc | Where-Object { $_ -match '^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+public\s+usuarios\b' }) {
        throw 'La exportacion incluyo datos de usuarios. No se entregara este archivo.'
    }
    & docker cp ("${SourceContainer}:${inside}") $target
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) { throw 'No se pudo copiar el respaldo desde el contenedor.' }
    $length = (Get-Item $target).Length
    if ($length -lt 1000) { Remove-Item $target -Force; throw 'El respaldo parece incompleto.' }
    Write-Host "OK: Copia de la base de pruebas creada: $target"
    Write-Host "Tamanio: $length bytes. No se han copiado filas de public.usuarios."
    Write-Warning 'Antes de publicarlo en GitHub: revisa que el resto de la base (productos, historial, proveedores, etc.) sea realmente compartible.'
    Write-Host 'Siguiente: prueba la restauracion con .\INICIAR_EQUIPO.ps1 en puertos libres; despues comparte este archivo de manera autorizada.'
} finally {
    & docker exec $SourceContainer rm -f $inside 2>$null | Out-Null
}
