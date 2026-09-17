param([Parameter(Mandatory)][string]$PublishPath, [string]$EvidencePath)
# PowerShell 7; yalnız ayrıca sintetik content root. Real konfiqurasiya/log dəyərləri çıxarılmır.
$ErrorActionPreference = 'Stop'
$apiDll = Join-Path ([IO.Path]::GetFullPath($PublishPath)) 'Kiberaz.Api.dll'
if (-not (Test-Path -LiteralPath $apiDll)) { throw 'Release DLL tapılmadı.' }
$forbidden = @(Get-ChildItem -LiteralPath $PublishPath -Recurse -File | Where-Object {
    $_.Name -match '^appsettings\.(Local|.*\.Local|Development|.*\.example)\.json$|\.(db|db-journal|db-wal|pfx|key)$'
})
if ($forbidden.Count) { throw 'Release paketində qadağan edilmiş lokal config, baza və ya açar faylı var.' }
$probeRoot = Join-Path ([IO.Path]::GetTempPath()) ('kiberaz-release-probe-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($probeRoot) | Out-Null
$cases = @(
    @{Name='production-ignores-local'; Environment='Production'; Poison=$true; Secret='1x0000000000000000000000000000000AA'; Bypass='false'; Expected='TEST acaridir'},
    @{Name='staging-ignores-local'; Environment='Staging'; Poison=$true; Secret='1x0000000000000000000000000000000AA'; Bypass='false'; Expected='TEST acaridir'},
    @{Name='development-reads-local'; Environment='Development'; Poison=$true; Secret=''; Bypass='false'; Expected='appsettings.Local.json'},
    @{Name='production-missing-captcha'; Environment='Production'; Poison=$false; Secret=''; Bypass='false'; Expected='production-da teyin edilmeyib'},
    @{Name='production-bypass-rejected'; Environment='Production'; Poison=$false; Secret='synthetic-nonproduction'; Bypass='true'; Expected='production konfiqurasiyasinda true-dur'}
)
$results = @()
foreach ($case in $cases) {
    $caseRoot = Join-Path $probeRoot $case.Name
    [IO.Directory]::CreateDirectory($caseRoot) | Out-Null
    if ($case.Poison) { [IO.File]::WriteAllText((Join-Path $caseRoot 'appsettings.Local.json'), '{ deliberately invalid JSON') }
    $settings = @{
        'ConnectionStrings__LiteDb'="Filename=$caseRoot/probe.db;Connection=direct"
        'DataProtection__KeysPath'="$caseRoot/keys"
        'JwtSettings__SecretKey'=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
        'JwtSettings__Issuer'='qa-release'; 'JwtSettings__Audience'='qa-release'
        'Captcha__SecretKey'=$case.Secret; 'Captcha__AllowDevelopmentBypass'=$case.Bypass
        'Authentication__Google__ClientId'=''; 'Authentication__Google__ClientSecret'=''
        'EmailSettings__SmtpHost'='127.0.0.1'; 'EmailSettings__SmtpPort'='9'
        'EmailSettings__SmtpUsername'=''; 'EmailSettings__SmtpPassword'=''
        'EmailSettings__FromEmail'='no-email@example.invalid'; 'FrontendUrl'='http://localhost:5189'
        'Logging__LogLevel__Default'='Warning'
    }
    $start = [Diagnostics.ProcessStartInfo]::new('dotnet')
    $start.UseShellExecute=$false; $start.CreateNoWindow=$true
    $start.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
    $start.WorkingDirectory=$caseRoot
    $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
    foreach ($key in @($start.Environment.Keys)) {
        if ($key -match '^(ASPNETCORE|DOTNET_ENVIRONMENT|ConnectionStrings|DataProtection|JwtSettings|Captcha|EmailSettings|Authentication|FrontendUrl|Kestrel|Urls|Logging|AdminBootstrap)') {
            $start.Environment.Remove($key) | Out-Null
        }
    }
    $start.Environment['ASPNETCORE_ENVIRONMENT']=$case.Environment
    $start.Environment['DOTNET_ENVIRONMENT']=$case.Environment
    foreach ($key in $settings.Keys) { $start.Environment[$key]=$settings[$key] }
    foreach ($arg in @($apiDll,'--contentRoot',$caseRoot,'--urls','http://127.0.0.1:0')) { $start.ArgumentList.Add($arg) }
    $process=[Diagnostics.Process]::Start($start)
    $stdout=$process.StandardOutput.ReadToEndAsync(); $stderr=$process.StandardError.ReadToEndAsync()
    try {
        $finished=$process.WaitForExit(30000)
        if (-not $finished) { $process.Kill($true); $process.WaitForExit() }
        $output=$stdout.GetAwaiter().GetResult()+$stderr.GetAwaiter().GetResult()
        $passed=$finished -and $process.ExitCode -ne 0 -and $output.Contains($case.Expected) -and -not $output.Contains('Now listening on')
        $results += [pscustomobject]@{name=$case.Name; passed=$passed; exitCode=$process.ExitCode; diagnosticMatched=$output.Contains($case.Expected); timedOut=(-not $finished)}
    } finally {
        if (-not $process.HasExited) { $process.Kill($true); $process.WaitForExit() }
        $process.Dispose()
    }
}
if ($EvidencePath) { $results | ConvertTo-Json | Set-Content -LiteralPath $EvidencePath }
$results | Format-Table
if (@($results | Where-Object { -not $_.passed }).Count) { throw 'Release konfiqurasiya regressiyası keçmədi.' }
Write-Host 'PASS: paket təmizdir; Production/Staging lokal config oxumur; fail-closed saxlanır.'
