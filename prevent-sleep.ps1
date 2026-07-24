$signature = @"
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
"@

$powerManagement = Add-Type -MemberDefinition $signature -Name "PowerManagement" -Namespace "Win32" -PassThru

# ES_CONTINUOUS = 0x80000000
# ES_SYSTEM_REQUIRED = 0x00000001
# ES_DISPLAY_REQUIRED = 0x00000002

$ES_CONTINUOUS = 0x80000000
$ES_SYSTEM_REQUIRED = 0x00000001
$ES_DISPLAY_REQUIRED = 0x00000002

# Prevent Sleep
$powerManagement::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED -bor $ES_DISPLAY_REQUIRED)

Write-Host "System sleep and display turn-off prevented. Press Ctrl+C to exit."

# Keep running
try {
    while ($true) {
        Start-Sleep -Seconds 60
    }
} finally {
    # Restore normal behavior on exit
    $powerManagement::SetThreadExecutionState($ES_CONTINUOUS)
    Write-Host "Restored normal sleep behavior."
}
