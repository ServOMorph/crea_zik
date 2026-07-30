[CmdletBinding()]
param(
    [switch]$ProbeFailure
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$resultsDirectory = Join-Path $PSScriptRoot "test-results"
$reportPath = Join-Path $resultsDirectory "v1-$runId.json"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) "crea-zik-editor-$runId"
$results = [System.Collections.Generic.List[object]]::new()

New-Item -ItemType Directory -Force -Path $resultsDirectory | Out-Null
Get-ChildItem -LiteralPath $resultsDirectory -Directory -Filter "probes-*" | Remove-Item -Recurse -Force
New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null

function Write-Report {
    $report = [ordered]@{
        run_id = $runId
        temporary_root = $temporaryRoot
        success = -not ($results | Where-Object { $_.status -eq "failed" })
        checks = $results
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding utf8
}

function Invoke-Gate {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments
    )

    $startedAt = Get-Date
    $exitCode = 1
    try {
        Push-Location $WorkingDirectory
        & $Command @Arguments
        $exitCode = $LASTEXITCODE
    }
    catch {
        Write-Error $_
    }
    finally {
        Pop-Location
    }
    $results.Add([pscustomobject]@{
        name = $Name
        command = "$Command $($Arguments -join ' ')"
        status = if ($exitCode -eq 0) { "passed" } else { "failed" }
        exit_code = $exitCode
        duration_seconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 3)
    })
    if ($exitCode -ne 0) {
        Write-Report
        Write-Host "Gate failed: $Name. Report: $reportPath"
        exit $exitCode
    }
}

function Invoke-ExpectedFailure {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments
    )

    $startedAt = Get-Date
    Push-Location $WorkingDirectory
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    Pop-Location
    $results.Add([pscustomobject]@{
        name = $Name
        command = "$Command $($Arguments -join ' ')"
        status = if ($exitCode -ne 0) { "expected_failure" } else { "failed" }
        exit_code = $exitCode
        duration_seconds = [math]::Round(((Get-Date) - $startedAt).TotalSeconds, 3)
    })
    if ($exitCode -eq 0) {
        Write-Report
        Write-Host "Failure probe did not fail: $Name. Report: $reportPath"
        exit 1
    }
}

$env:CREA_ZIK_PROJECT_ROOT = Join-Path $temporaryRoot "projects"
$referenceOutput = Join-Path $temporaryRoot "lignes-de-nuit"

Invoke-Gate -Name "python-lock" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("lock", "--check")
Invoke-Gate -Name "python-lint-v0" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "ruff", "check", "EDITEUR/verify_lignes_reference.py", "tests/test_editor_contracts.py", "tests/test_csound_determinism.py")
Invoke-Gate -Name "python-types-v0" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "mypy", "EDITEUR/verify_lignes_reference.py")
Invoke-Gate -Name "composition-contracts" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "pytest", "tests/test_editor_contracts.py", "tests/test_csound_determinism.py")
Invoke-Gate -Name "python-lint-v1" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "ruff", "check", "backend/src/crea_zik/api.py", "backend/src/crea_zik/composition_dsp.py", "backend/src/crea_zik/compositions.py", "backend/src/crea_zik/gallery.py", "backend/src/crea_zik/models.py", "tests/test_api.py", "tests/test_compositions.py")
Invoke-Gate -Name "python-types-v1" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "mypy", "backend/src/crea_zik/api.py", "backend/src/crea_zik/composition_dsp.py", "backend/src/crea_zik/compositions.py", "backend/src/crea_zik/gallery.py", "backend/src/crea_zik/models.py")
Invoke-Gate -Name "composition-domain" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "pytest", "tests/test_api.py", "tests/test_compositions.py", "tests/test_foundation.py", "tests/test_composer.py")
Invoke-Gate -Name "lignes-de-nuit-reference" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "python", "EDITEUR/verify_lignes_reference.py", "--source", "EXPLO/morceau_electro", "--golden", "EDITEUR/fixtures/lignes_de_nuit.golden.json", "--output", $referenceOutput)
Invoke-Gate -Name "frontend-lint" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npm" -Arguments @("run", "lint")
Invoke-Gate -Name "frontend-types" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npm" -Arguments @("run", "typecheck")
Invoke-Gate -Name "frontend-unit" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npm" -Arguments @("run", "test:unit")
Invoke-Gate -Name "frontend-build" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npm" -Arguments @("run", "build")
Invoke-Gate -Name "frontend-e2e" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npm" -Arguments @("run", "test:e2e")

if ($ProbeFailure) {
    $probeDirectory = Join-Path $resultsDirectory "probes-$runId"
    $pythonProbe = Join-Path $probeDirectory "test_python_failure_probe.py"
    $frontendProbe = Join-Path (Join-Path $projectRoot "frontend\src") ".v0-frontend-failure-$runId.test.ts"
    New-Item -ItemType Directory -Force -Path $probeDirectory | Out-Null
    [System.IO.File]::WriteAllText($pythonProbe, "def test_runner_blocks_python_failure():`n    assert False`n")
    [System.IO.File]::WriteAllText($frontendProbe, "import { expect, test } from 'vitest';`ntest('runner blocks frontend failure', () => expect(true).toBe(false));`n")
    try {
        Invoke-ExpectedFailure -Name "python-runner-blocks-failure" -WorkingDirectory $projectRoot -Command "uv" -Arguments @("run", "pytest", (Join-Path "EDITEUR\test-results" "probes-$runId\test_python_failure_probe.py"))
        Invoke-ExpectedFailure -Name "frontend-runner-blocks-failure" -WorkingDirectory (Join-Path $projectRoot "frontend") -Command "npx" -Arguments @("vitest", "run", (Join-Path "src" ".v0-frontend-failure-$runId.test.ts"))
    }
    finally {
        Remove-Item -LiteralPath $pythonProbe -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $probeDirectory -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $frontendProbe -Force -ErrorAction SilentlyContinue
    }
}

Write-Report
Write-Host "V1 gate passed. Report: $reportPath"
