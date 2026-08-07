<#
.SYNOPSIS
    Exécute les tests e2e en local avec les serveurs existants.
.DESCRIPTION
    Usage:
        .\scripts\test-local.ps1              # Tous les tests e2e
        .\scripts\test-local.ps1 transport    # Test du transport uniquement
        .\scripts\test-local.ps1 piano       # Test du piano roll uniquement
#>

param (
    [string]$TestFilter = ""
)

# Vérifier les serveurs
function Test-Server {
    param ($Url, $Name)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -ErrorAction Stop -UseBasicParsing
        Write-Host "✓ $Name est démarré ($Url)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "✗ $Name N'EST PAS démarré ($Url)" -ForegroundColor Red
        return $false
    }
}

Write-Host "=== Vérification des serveurs ===" -ForegroundColor Yellow
$backendOk = Test-Server -Url "http://127.0.0.1:8001/api/health" -Name "Backend"
$frontendOk = Test-Server -Url "http://127.0.0.1:5180" -Name "Frontend"

if (-not $backendOk -or -not $frontendOk) {
    Write-Host "Erreur : Les serveurs doivent être démarrés manuellement." -ForegroundColor Red
    Write-Host "Démarrez-les avec :"
    Write-Host "  Backend: cd backend && uv run uvicorn crea_zik.api:app --host 127.0.0.1 --port 8001"
    Write-Host "  Frontend: cd frontend && npm run dev -- --host 127.0.0.1 --port 5180"
    exit 1
}

# Déterminer le filtre
if ([string]::IsNullOrEmpty($TestFilter)) {
    $testFilter = "--grep-invert @visual"
} else {
    switch ($TestFilter) {
        "transport" { $testFilter = "--grep 'the editor transport plays'" }
        "piano"    { $testFilter = "--grep 'the piano roll'" }
        default    { $testFilter = "--grep '$TestFilter'" }
    }
}

Write-Host "`n=== Exécution des tests ===" -ForegroundColor Yellow
Write-Host "Filtre: $testFilter"
Write-Host "Timeout: 90s (global), 60s (préécoute), 10s (playhead)"

# Exécuter Playwright
Write-Host "`nDémarrage de Playwright..." -ForegroundColor Cyan
npx playwright test --config playwright.test.config.ts $testFilter --timeout=90000 --retries=1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Tests passés !" -ForegroundColor Green
} else {
    Write-Host "`n✗ Tests échoués" -ForegroundColor Red
    Write-Host "Pour déboguer :"
    Write-Host "  - Ajoutez --headed pour voir le navigateur"
    Write-Host "  - Ajoutez --debug pour plus de logs"
    Write-Host "  - Consultez test-results/ pour les traces"
}
