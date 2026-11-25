param([string]$PythonExe)

$ErrorActionPreference = 'Stop'
$venvPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'

function Assert-Python312 {
    param([string]$Executable)
    & $Executable -c "import sys; assert sys.version_info[:2] == (3, 12), 'Estas dependencias requieren Python 3.12; version actual: ' + sys.version"
    if ($LASTEXITCODE -ne 0) {
        throw 'Selecciona Python 3.12 mediante -PythonExe o revisa el entorno .venv existente.'
    }
}

Push-Location $PSScriptRoot
try {
    foreach ($csv in @('ventas.csv', 'productos.csv', 'proveedores.csv')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "data/$csv"))) {
            throw "Falta data/$csv. Copia los CSV de prueba del ZIP antes de ejecutar la suite."
        }
    }

    if (-not (Test-Path -LiteralPath $venvPython)) {
        if (-not $PythonExe) {
            if (Get-Command py -ErrorAction SilentlyContinue) {
                $candidate = & py -3.12 -c 'import sys; print(sys.executable)' 2>$null
                if ($LASTEXITCODE -eq 0) { $PythonExe = $candidate }
            }
            if (-not $PythonExe -and (Get-Command python -ErrorAction SilentlyContinue)) {
                $PythonExe = (Get-Command python).Source
            }
        }
        if (-not $PythonExe) {
            throw 'Instala Python 3.12 o indica su ruta con -PythonExe.'
        }
        Assert-Python312 $PythonExe
        & $PythonExe -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno virtual .venv.' }
    }

    Assert-Python312 $venvPython
    Write-Host 'Instalando/verificando todas las dependencias de ML y de pruebas...' -ForegroundColor Cyan
    & $venvPython -m pip install --disable-pip-version-check -r requirements-dev.txt
    if ($LASTEXITCODE -ne 0) { throw 'No se completó la instalación. No se ejecutarán pruebas con dependencias incompletas.' }
    & $venvPython -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Se detectaron dependencias incompatibles en .venv.' }
    & $venvPython -c "import psycopg; from psycopg import pq; assert pq.__impl__ == 'binary'; print('psycopg', psycopg.__version__, '- controlador binario disponible')"
    if ($LASTEXITCODE -ne 0) { throw 'No se puede importar el controlador psycopg binario.' }

    Write-Host 'Ejecutando la suite Python con los CSV de prueba...' -ForegroundColor Cyan
    & $venvPython -m pytest -q --junitxml=test-results/pytest.xml
    if ($LASTEXITCODE -ne 0) { throw 'La suite Python no fue aprobada. Revisa test-results/pytest.xml.' }
    Write-Host 'Suite Python aprobada. Evidencia: ml-service/test-results/pytest.xml' -ForegroundColor Green
} finally {
    Pop-Location
}
