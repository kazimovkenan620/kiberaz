$ErrorActionPreference = 'Stop'
$probeRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) '20260917T-predeploy-132107/production-probes'))
$probeRunRoot = [IO.Path]::GetDirectoryName($probeRoot)
$probeApi = Join-Path $probeRunRoot 'publish/Kiberaz.Api.dll'
$probeEvidence = Join-Path $PSScriptRoot '../../docs/qa/20260917T-predeploy-132107/evidence/production-startup-probes.json'
if (-not (Test-Path -LiteralPath $probeApi)) { throw 'Nəşr edilmiş QA API tapılmadı.' }
if (Test-Path -LiteralPath $probeRoot) { throw 'Mövcud probe qovluğu qorunur; yenidən icra rədd edildi.' }
$probeAncestor = [IO.DirectoryInfo]::new($probeRoot)
while ($null -ne $probeAncestor) {
    if ($probeAncestor.Exists -and ($probeAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Reparse yolu qəbul edilmir.'
    }
    $probeAncestor = $probeAncestor.Parent
}
[IO.Directory]::CreateDirectory($probeRoot) | Out-Null
$probeCases = @(
    @{ Name = 'missing-secret'; Secret = ''; Bypass = 'false'; Expected = 'Captcha:SecretKey production-da teyin edilmeyib' },
    @{ Name = 'official-test-key'; Secret = '1x0000000000000000000000000000000AA'; Bypass = 'false'; Expected = 'Captcha:SecretKey Cloudflare-in TEST acaridir' },
    @{ Name = 'bypass-enabled'; Secret = 'synthetic-qa-nonproduction-secret'; Bypass = 'true'; Expected = 'Captcha:AllowDevelopmentBypass production konfiqurasiyasinda true-dur' }
)
$probeResults = @()
foreach ($probeCase in $probeCases) {
    $probeCaseRoot = Join-Path $probeRoot $probeCase.Name
    [IO.Directory]::CreateDirectory($probeCaseRoot) | Out-Null
    $probeListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $probeListener.Start()
    $probePort = $probeListener.LocalEndpoint.Port
    $probeListener.Stop()
    $probeSettings = @{
        'ConnectionStrings:LiteDb' = ('Filename=' + (Join-Path $probeCaseRoot 'probe.db') + ';Connection=direct')
        'JwtSettings:SecretKey' = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
        'JwtSettings:Issuer' = 'kiberaz-production-probe'
        'JwtSettings:Audience' = 'kiberaz-production-probe'
        'Captcha:SecretKey' = $probeCase.Secret
        'Captcha:AllowDevelopmentBypass' = $probeCase.Bypass
        'DataProtection:KeysPath' = (Join-Path $probeCaseRoot 'keys')
        'Authentication:Google:ClientId' = ''
        'Authentication:Google:ClientSecret' = ''
        'EmailSettings:SmtpHost' = '127.0.0.1'
        'EmailSettings:SmtpPort' = '9'
        'EmailSettings:SmtpUsername' = ''
        'EmailSettings:SmtpPassword' = ''
        'EmailSettings:FromEmail' = 'no-email@example.invalid'
        'FrontendUrl' = 'http://localhost:5189'
        'AllowedHosts' = 'localhost;127.0.0.1'
        'Logging:LogLevel:Default' = 'Warning'
    }
    $probeConfig = $probeSettings | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $probeCaseRoot 'appsettings.json'), $probeConfig)
    [IO.File]::WriteAllText((Join-Path $probeCaseRoot 'appsettings.Local.json'), $probeConfig)
    $probeStart = [Diagnostics.ProcessStartInfo]::new('dotnet')
    $probeStart.UseShellExecute = $false
    $probeStart.CreateNoWindow = $true
    $probeStart.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $probeStart.WorkingDirectory = $probeCaseRoot
    $probeStart.RedirectStandardOutput = $true
    $probeStart.RedirectStandardError = $true
    foreach ($probeArg in @($probeApi, '--contentRoot', $probeCaseRoot, '--urls', "http://127.0.0.1:$probePort")) {
        $probeStart.ArgumentList.Add($probeArg)
    }
    foreach ($probeEnvKey in @($probeStart.Environment.Keys)) {
        if ($probeEnvKey -match '^(ConnectionStrings|JwtSettings|Captcha|DataProtection|EmailSettings|Authentication|Uploads|Kestrel|ASPNETCORE|DOTNET_ENVIRONMENT|FrontendUrl|AllowedHosts|Urls|Cors)') {
            $probeStart.Environment.Remove($probeEnvKey) | Out-Null
        }
    }
    $probeStart.Environment['ASPNETCORE_ENVIRONMENT'] = 'Production'
    $probeStart.Environment['DOTNET_ENVIRONMENT'] = 'Production'
    foreach ($probeKey in $probeSettings.Keys) { $probeStart.Environment[$probeKey.Replace(':', '__')] = $probeSettings[$probeKey] }
    $probeStarted = [DateTimeOffset]::UtcNow
    $probeProcess = [Diagnostics.Process]::Start($probeStart)
    $probeStdout = $probeProcess.StandardOutput.ReadToEndAsync()
    $probeStderr = $probeProcess.StandardError.ReadToEndAsync()
    $probeListening = $false
    $probeTimedOut = $false
    try {
        while (-not $probeProcess.HasExited) {
            $probeListening = $probeListening -or [bool]([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object Port -EQ $probePort)
            if (([DateTimeOffset]::UtcNow - $probeStarted).TotalSeconds -gt 20) {
                $probeTimedOut = $true
                $probeProcess.Kill($true)
                break
            }
            Start-Sleep -Milliseconds 50
        }
        $probeProcess.WaitForExit()
        $probeOutput = $probeStdout.GetAwaiter().GetResult() + $probeStderr.GetAwaiter().GetResult()
        $probeExit = $probeProcess.ExitCode
    }
    finally {
        if (-not $probeProcess.HasExited) { $probeProcess.Kill($true); $probeProcess.WaitForExit() }
        $probeProcess.Dispose()
    }
    $probeRedacted = $probeOutput -replace '(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[EMAIL_REDACTED]' -replace '\b[A-Fa-f0-9]{64,}\b', '[SECRET_REDACTED]' -replace 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[JWT_REDACTED]'
    $probeMatched = $probeRedacted.Contains($probeCase.Expected)
    $probePass = $probeExit -ne 0 -and $probeMatched -and -not $probeTimedOut -and -not $probeListening -and -not $probeRedacted.Contains('Now listening on')
    $probeResults += [pscustomobject]@{
        name = $probeCase.Name; passed = $probePass; exitCode = $probeExit; expectedDiagnostic = $probeCase.Expected
        expectedDiagnosticMatched = $probeMatched; listenerObserved = $probeListening; timedOut = $probeTimedOut
        startedUtc = $probeStarted.ToString('o'); finishedUtc = [DateTimeOffset]::UtcNow.ToString('o')
        environment = 'Production'; port = $probePort; diagnostic = $probeRedacted.Trim()
    }
}
$probeResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $probeEvidence -Encoding utf8
$probeResults | Select-Object name,passed,exitCode,expectedDiagnosticMatched,listenerObserved,timedOut | Format-Table
if (@($probeResults | Where-Object { -not $_.passed }).Count -gt 0) { exit 1 }
