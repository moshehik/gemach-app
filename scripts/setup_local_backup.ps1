<#
.SYNOPSIS
  Idempotent installer for gemach-app's local backup capability (both orgs).

.DESCRIPTION
  Provisions everything needed to run scripts/backup_prod_db.js and
  scripts/cleanup_old_logs.js on this machine (or a replacement machine that
  already has this repo checked out): Node.js check, npm dependencies
  (including the `pg` driver), env-var presence check for both orgs' DB URLs,
  and the two Windows Scheduled Tasks. Safe to re-run any number of times -
  it detects what's already correctly set up and leaves it alone, and only
  changes what's missing or drifted.

  IMPORTANT - read before enabling automatic local backups for both orgs:
  scripts/backup_prod_db.js used to run automatically every night
  (GemachApp-ProdDbBackup, 03:30) but that task was DELIBERATELY DISABLED on
  2026-09-20 after running it alongside the newer cloud backup
  (scripts/cloud_backup.js -> GitHub Actions -> Google Drive, which already
  covers BOTH orgs automatically and does not depend on this machine being on)
  caused org1's Neon project to exceed its free-tier 5GB/month data-transfer
  quota and take the site down - two full-DB reads/day instead of one. See
  BACKUPS.md's "Layer 2" and "Backups count against Neon egress" sections for
  the full story. This script therefore registers GemachApp-ProdDbBackup in a
  DISABLED state by default when creating it fresh, and never silently flips
  an existing task's enabled/disabled state either way - only the schedule/
  action are kept correct. GemachApp-LogCleanup has no such conflict (it only
  DELETEs old log rows, it does not read/transfer the whole database) and is
  registered enabled as before.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\setup_local_backup.ps1
  npm run setup:backup
#>

$ErrorActionPreference = 'Stop'
$results = @()  # { Item, Status, Detail }

function Add-Result([string]$Item, [string]$Status, [string]$Detail) {
  $script:results += [PSCustomObject]@{ Item = $Item; Status = $Status; Detail = $Detail }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Write-Host "gemach-app local backup setup - repo root: $RepoRoot" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Node.js
# ---------------------------------------------------------------------------
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Cyan
$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Add-Result "Node.js" "MISSING" "Not found on PATH. Download: https://nodejs.org/en/download"
  Write-Host "  Node.js not found. Install it from https://nodejs.org/en/download, then re-run this script." -ForegroundColor Red
  Write-Host ""
  Write-Host "=== Summary (stopped early - Node.js is required) ===" -ForegroundColor Yellow
  $results | Format-Table -AutoSize
  exit 1
}
$nodePath = $nodeCmd.Source
$nodeVersion = (& $nodePath --version).Trim()
$pkgJsonPath = Join-Path $RepoRoot 'package.json'
$expectedEngine = $null
if (Test-Path $pkgJsonPath) {
  try {
    $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
    if ($pkg.engines -and $pkg.engines.node) { $expectedEngine = $pkg.engines.node }
  } catch { }
}
if ($expectedEngine) {
  Add-Result "Node.js" "OK" "$nodeVersion found at $nodePath (package.json engines.node: $expectedEngine - not enforced by this script, verify manually if in doubt)"
  Write-Host "  Found $nodeVersion at $nodePath (package.json wants: $expectedEngine)" -ForegroundColor Green
} else {
  Add-Result "Node.js" "OK" "$nodeVersion found at $nodePath (no engines field in package.json to compare against)"
  Write-Host "  Found $nodeVersion at $nodePath" -ForegroundColor Green
}
Write-Host ""

# ---------------------------------------------------------------------------
# 2. npm dependencies (pg driver in particular)
# ---------------------------------------------------------------------------
Write-Host "[2/5] Checking npm dependencies..." -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  $needsInstall = $true
  $nodeModulesPath = Join-Path $RepoRoot 'node_modules\pg'
  if (Test-Path $nodeModulesPath) {
    try {
      & $nodePath -e "require('pg')" 2>$null
      if ($LASTEXITCODE -eq 0) { $needsInstall = $false }
    } catch { $needsInstall = $true }
  }

  if ($needsInstall) {
    Write-Host "  Installing dependencies (this can take a few minutes)..." -ForegroundColor Yellow
    $lockPath = Join-Path $RepoRoot 'package-lock.json'
    if (Test-Path $lockPath) {
      & npm ci 2>&1 | Write-Host
      if ($LASTEXITCODE -ne 0) {
        Write-Host "  'npm ci' failed, falling back to 'npm install'..." -ForegroundColor Yellow
        & npm install 2>&1 | Write-Host
      }
    } else {
      & npm install 2>&1 | Write-Host
    }
  } else {
    Write-Host "  node_modules already present." -ForegroundColor Green
  }

  $pgCheck = & $nodePath -e "require('pg'); console.log('OK')" 2>&1
  if ($pgCheck -match 'OK') {
    Add-Result "npm dependencies (pg driver)" "OK" "require('pg') resolves"
    Write-Host "  'pg' driver resolves correctly." -ForegroundColor Green
  } else {
    Add-Result "npm dependencies (pg driver)" "FAILED" "require('pg') did not resolve: $pgCheck"
    Write-Host "  'pg' still does not resolve after install: $pgCheck" -ForegroundColor Red
  }
} finally {
  Pop-Location
}
Write-Host ""

# ---------------------------------------------------------------------------
# 3. Env vars (presence only - never print secret values)
# ---------------------------------------------------------------------------
Write-Host "[3/5] Checking DB connection env vars (.env.local / .env)..." -ForegroundColor Cyan
function Get-EnvKeys([string]$path) {
  if (-not (Test-Path $path)) { return @() }
  $keys = @()
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $eq = $t.IndexOf('=')
    if ($eq -lt 0) { continue }
    $keys += $t.Substring(0, $eq).Trim()
  }
  return $keys
}
$envKeys = @(Get-EnvKeys (Join-Path $RepoRoot '.env.local')) + @(Get-EnvKeys (Join-Path $RepoRoot '.env')) | Select-Object -Unique

$org1Present = ($envKeys -contains 'DATABASE_URL') -or ($envKeys -contains 'PROD_DATABASE_URL')
$org2Present = ($envKeys -contains 'DATABASE_URL_ORG2') -or ($envKeys -contains 'PROD_DATABASE_URL_ORG2')

if ($org1Present) {
  Add-Result "org1 DB URL (required)" "OK" "DATABASE_URL or PROD_DATABASE_URL present in .env.local/.env"
  Write-Host "  org1: found (DATABASE_URL / PROD_DATABASE_URL)." -ForegroundColor Green
} else {
  Add-Result "org1 DB URL (required)" "MISSING" "Add DATABASE_URL or PROD_DATABASE_URL to .env.local or .env - backups cannot run for org1 without it."
  Write-Host "  org1: MISSING - add DATABASE_URL or PROD_DATABASE_URL to .env.local/.env." -ForegroundColor Red
}
if ($org2Present) {
  Add-Result "org2 DB URL (optional)" "OK" "DATABASE_URL_ORG2 or PROD_DATABASE_URL_ORG2 present"
  Write-Host "  org2: found (DATABASE_URL_ORG2 / PROD_DATABASE_URL_ORG2)." -ForegroundColor Green
} else {
  Add-Result "org2 DB URL (optional)" "WARN - not configured" "Org2 (Neve Yaakov) will be skipped by the backup script until DATABASE_URL_ORG2 or PROD_DATABASE_URL_ORG2 is added to .env.local/.env. See scratch/new_gemach_db.env for the current pointer (moves over time - re-check it, do not assume an old copy is still correct)."
  Write-Host "  org2: not configured - org2 will be SKIPPED by the backup script until this is added." -ForegroundColor Yellow
}
Write-Host ""

# ---------------------------------------------------------------------------
# 4. Scheduled Tasks
# ---------------------------------------------------------------------------
Write-Host "[4/5] Checking Windows Scheduled Tasks..." -ForegroundColor Cyan
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
if ($env:USERDOMAIN -eq $env:COMPUTERNAME -or -not $env:USERDOMAIN) { $currentUser = $env:USERNAME }

function Ensure-ScheduledTask {
  param(
    [string]$TaskName,
    [string]$ScriptRelPath,
    [string]$StartTime,       # "HH:mm"
    [string]$Comment,
    [bool]$EnabledByDefault
  )
  $scriptFullPath = Join-Path $RepoRoot $ScriptRelPath
  $expectedArgs = "`"$scriptFullPath`""

  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    $action = $existing.Actions | Select-Object -First 1
    $actionMatches = ($action.Execute -eq $nodePath) -and ($action.Arguments -eq $expectedArgs)
    if ($actionMatches) {
      Add-Result "Task: $TaskName" "OK" "Already registered correctly (state: $($existing.State)). Enabled/disabled state left untouched by this script."
      Write-Host "  $TaskName - already correct (state: $($existing.State))." -ForegroundColor Green
    } else {
      try {
        $newAction = New-ScheduledTaskAction -Execute $nodePath -Argument $expectedArgs
        Set-ScheduledTask -TaskName $TaskName -Action $newAction -ErrorAction Stop | Out-Null
        Add-Result "Task: $TaskName" "UPDATED" "Action path was stale, corrected to $nodePath $expectedArgs. State (enabled/disabled) left untouched."
        Write-Host "  $TaskName - action was stale, corrected. (state left as-is: $($existing.State))" -ForegroundColor Yellow
      } catch {
        Add-Result "Task: $TaskName" "FAILED" "Could not update stale action: $_"
        Write-Host "  $TaskName - failed to update stale action: $_" -ForegroundColor Red
      }
    }
    return
  }

  try {
    $taskAction = New-ScheduledTaskAction -Execute $nodePath -Argument $expectedArgs
    $taskTrigger = New-ScheduledTaskTrigger -Daily -At $StartTime
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive
    $taskSettings = New-ScheduledTaskSettingsSet -StopIfGoingOnBatteries -DontStartOnBatteries -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger `
      -Principal $taskPrincipal -Settings $taskSettings -Description $Comment -ErrorAction Stop | Out-Null

    if (-not $EnabledByDefault) {
      Disable-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null
      Add-Result "Task: $TaskName" "CREATED (disabled)" "Registered daily $StartTime but left DISABLED - see script header for why (Neon egress / 2026-09-20 outage). Enable with: Enable-ScheduledTask -TaskName `"$TaskName`""
      Write-Host "  $TaskName - created, left DISABLED (see script header for why)." -ForegroundColor Yellow
    } else {
      Add-Result "Task: $TaskName" "CREATED (enabled)" "Registered daily $StartTime, enabled."
      Write-Host "  $TaskName - created and enabled." -ForegroundColor Green
    }
  } catch {
    Add-Result "Task: $TaskName" "FAILED" "Could not register: $_"
    Write-Host "  $TaskName - failed to register: $_" -ForegroundColor Red
  }
}

Ensure-ScheduledTask -TaskName "GemachApp-ProdDbBackup" -ScriptRelPath "scripts\backup_prod_db.js" -StartTime "03:30" `
  -Comment "Nightly logical backup (gzip SQL dump) of the gemach-app production Neon DB(s). Runs scripts/backup_prod_db.js. See BACKUPS.md. NOTE: kept disabled by default - manual fallback only, see BACKUPS.md 'Backups count against Neon egress'." `
  -EnabledByDefault $false

Ensure-ScheduledTask -TaskName "GemachApp-LogCleanup" -ScriptRelPath "scripts\cleanup_old_logs.js" -StartTime "03:45" `
  -Comment "Nightly retention cleanup (deletes PageVisitLog/QueryLog rows older than 90 days). Runs scripts/cleanup_old_logs.js. See BACKUPS.md." `
  -EnabledByDefault $true

Write-Host ""

# ---------------------------------------------------------------------------
# 5. Summary
# ---------------------------------------------------------------------------
Write-Host "[5/5] Summary" -ForegroundColor Cyan
Write-Host ""
$results | Format-Table -AutoSize -Wrap

$needsAction = $results | Where-Object { $_.Status -match 'MISSING|FAILED|WARN' }
if ($needsAction) {
  Write-Host ""
  Write-Host "Manual action still needed:" -ForegroundColor Yellow
  foreach ($r in $needsAction) {
    Write-Host ("  - {0}: {1}" -f $r.Item, $r.Detail) -ForegroundColor Yellow
  }
} else {
  Write-Host ""
  Write-Host "Everything required is set up. GemachApp-ProdDbBackup is registered but stays DISABLED by design (manual fallback only) - see BACKUPS.md." -ForegroundColor Green
}
