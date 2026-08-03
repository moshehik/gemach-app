# deploy_monitor.ps1
# Script to monitor Vercel deployment and auto-fetch logs if it fails!

param (
    [string]$Token = "",
    [switch]$DeployFirst = $false
)

if ($DeployFirst) {
    Write-Host "Deploying to GitHub (which triggers Vercel)..." -ForegroundColor Cyan
    git push origin main
}

Write-Host "Waiting 20 seconds for Vercel to register the build..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

$maxRetries = 30 # 30 * 10 = 300 seconds (5 minutes)
$retryCount = 0
$deploymentUrl = ""

while ($retryCount -lt $maxRetries) {
    Write-Host "Checking Vercel status (Attempt $($retryCount + 1)/$maxRetries)..."
    
    # Run vercel ls and get the output
    $env:VERCEL_TOKEN = $Token
    $lsOutput = npx.cmd vercel ls --token $Token
    
    # Find the gemach-app-uyh4 deployment
    $targetLine = $lsOutput | Where-Object { $_ -match "moshehiks-projects/gemach-app-uyh4\s+(https://\S+)\s+● (Queued|Building|Ready|Error)" } | Select-Object -First 1

    if ($targetLine) {
        $deploymentUrl = $matches[1]
        $status = $matches[2]
        
        Write-Host "Current Status: $status ($deploymentUrl)" -ForegroundColor Cyan
        
        if ($status -eq "Ready") {
            Write-Host "✅ Deployment successful and live!" -ForegroundColor Green
            exit 0
        }
        elseif ($status -eq "Error") {
            Write-Host "❌ Deployment failed! Fetching logs..." -ForegroundColor Red
            
            # Fetch the logs of the failed deployment
            Write-Host "`n--- VERCEL LOGS ---" -ForegroundColor Yellow
            npx.cmd vercel inspect $deploymentUrl --token $Token
            Write-Host "-------------------`n" -ForegroundColor Yellow
            
            Write-Host "Please fix the error and try again." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Could not find the gemach-app-uyh4 deployment in the list..." -ForegroundColor DarkGray
    }

    Start-Sleep -Seconds 10
    $retryCount++
}

Write-Host "Timeout reached. The deployment is taking too long." -ForegroundColor Red
exit 1
