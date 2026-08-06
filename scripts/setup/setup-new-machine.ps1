# Sets up gemach-app on a fresh Windows machine: installs Node.js if missing,
# installs npm dependencies, generates the Prisma client, and checks for the
# .env / .env.local files the app needs to actually connect to anything.
#
# Usage: right-click -> "Run with PowerShell", or from a terminal:
#   powershell -ExecutionPolicy Bypass -File setup-new-machine.ps1
#
# Assumes the whole gemach-app folder was already copied to this machine
# (USB / network share / zip) - this script does not fetch app code itself.

$ErrorActionPreference = "Stop"
$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "!! $msg" -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host "OK: $msg" -ForegroundColor Green }

# ---------------------------------------------------------------------------
Write-Step "Checking for Node.js"

$needNode = $true
try {
    $nodeVersion = (& node -v) 2>$null
    if ($nodeVersion -match "^v(\d+)\.") {
        $major = [int]$Matches[1]
        if ($major -ge 22) {
            Write-Ok "Node.js $nodeVersion found"
            $needNode = $false
        } else {
            Write-Warn "Node.js $nodeVersion found, but this app needs 22.17+ or 24+"
        }
    }
} catch {
    Write-Warn "Node.js not found"
}

if ($needNode) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Warn "winget is not available on this machine."
        Write-Host "Install Node.js manually from https://nodejs.org (LTS, 22.x or newer), then re-run this script."
        exit 1
    }

    Write-Step "Installing Node.js LTS via winget (this opens its own progress window)"
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winget install failed. Install Node.js manually from https://nodejs.org and re-run this script."
        exit 1
    }

    Write-Warn "Node.js was just installed. Close this window, open a NEW PowerShell window (so PATH refreshes), and re-run this script."
    exit 0
}

# ---------------------------------------------------------------------------
Write-Step "Installing npm dependencies in $appRoot"
Push-Location $appRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Write-Ok "npm install complete"

    Write-Step "Generating Prisma client"
    npx prisma generate
    if ($LASTEXITCODE -ne 0) { throw "prisma generate failed" }
    Write-Ok "Prisma client generated"
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
Write-Step "Checking for environment files"

$envMissing = @()
foreach ($f in @(".env", ".env.local")) {
    $path = Join-Path $appRoot $f
    if (-not (Test-Path $path)) { $envMissing += $f }
}

if ($envMissing.Count -gt 0) {
    Write-Warn "Missing: $($envMissing -join ', ')"
    Write-Host @"
These files hold secrets (database connection strings, API keys) and are
never copied automatically. Copy them from the original machine's
gemach-app folder (USB / network share) into:
  $appRoot
then re-run this script (or just start the app once they're in place).

Required keys:
  .env        - SQLITE_URL, PROD_DATABASE_URL, TEST_DATABASE_URL, DATABASE_URL, POSTGRES_URL
  .env.local  - GEMINI_API_KEYS, NEON_API_KEY
"@
} else {
    Write-Ok ".env and .env.local found"
}

# ---------------------------------------------------------------------------
Write-Step "Done"
if ($envMissing.Count -eq 0) {
    Write-Host "Setup complete. Start the app with:`n  cd `"$appRoot`"`n  npm run dev`nThen open http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "Setup finished, but copy the env files above before running 'npm run dev'." -ForegroundColor Yellow
}
