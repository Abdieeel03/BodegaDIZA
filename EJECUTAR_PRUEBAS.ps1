param([switch]$MostrarNavegador, [switch]$IncluirML)

$ErrorActionPreference = 'Stop'

function Invoke-TestStep {
    param([string]$Directory, [scriptblock]$Command)
    Push-Location (Join-Path $PSScriptRoot $Directory)
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Las pruebas de $Directory terminaron con código $LASTEXITCODE. Revisa el reporte."
        }
    } finally {
        Pop-Location
    }
}

Write-Host '1/2 Pruebas de Java (JUnit + H2)' -ForegroundColor Cyan
Invoke-TestStep 'api' { .\gradlew.bat test --console=plain }

Write-Host '2/2 Pruebas funcionales (Chromium + API real + H2 temporal)' -ForegroundColor Cyan
if ($MostrarNavegador) {
    Invoke-TestStep 'frontend-sistema' { npm run test:headed }
} else {
    Invoke-TestStep 'frontend-sistema' { npm test }
}

if ($IncluirML) {
    Write-Host 'Pruebas de Machine Learning (entorno Python 3.12)' -ForegroundColor Cyan
    Invoke-TestStep 'ml-service' { .\PROBAR_ML.ps1 }
}

Write-Host 'Pruebas solicitadas aprobadas. Reporte funcional: frontend-sistema/playwright-report/index.html' -ForegroundColor Green
