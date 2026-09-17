param([string]$FrontendEnvPath, [string]$OutputDirectory)
# PowerShell 7. Repo kökündən: pwsh -File deploy/predeploy-check.ps1
# Hər run ayrıca paket yaradır; mövcud publish/node_modules və sirlər dəyişdirilmir.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $FrontendEnvPath) { $FrontendEnvPath=Join-Path $root 'kiberaz-ui/.env.production' }
if (-not $OutputDirectory) { $OutputDirectory=Join-Path $root ('artifacts/releases/'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8)) }
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Çıxış qovluğu artıq mövcuddur; əvvəlki paketi qoruyuruq.' }
if (-not (Test-Path -LiteralPath $FrontendEnvPath)) { throw 'Frontend .env.production yoxdur. Yalnız public API URL və Turnstile site key hazırlayın.' }
$publicSettings=@{}
foreach ($line in Get-Content -LiteralPath $FrontendEnvPath) {
    if ($line -match '^\s*(#|$)') { continue }
    if ($line -notmatch '^\s*(VITE_API_URL|VITE_TURNSTILE_SITE_KEY)\s*=\s*(.*?)\s*$') { throw 'Production frontend config yalnız API URL və PUBLIC Turnstile site key saxlamalıdır.' }
    $publicSettings[$Matches[1]]=$Matches[2].Trim('"', "'")
}
if ($publicSettings['VITE_API_URL'] -ne 'https://api.kiberaz.az/api') { throw 'Production API URL https://api.kiberaz.az/api olmalıdır.' }
if ($publicSettings['VITE_TURNSTILE_SITE_KEY'] -notmatch '^0x[A-Za-z0-9_-]{15,}$') { throw 'Real PUBLIC Turnstile site key tələb olunur; test/placeholder qəbul edilmir.' }
function Run([string]$Command,[string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command yoxlaması keçmədi (exit $LASTEXITCODE)." }
}
$previousLocation=Get-Location
$savedVite=@{}
foreach ($item in Get-ChildItem Env: | Where-Object Name -like 'VITE_*') { $savedVite[$item.Name]=$item.Value }
try {
    Set-Location $root
    $sdk=[version]((& dotnet --version).Split('-')[0])
    if ($LASTEXITCODE -ne 0 -or $sdk.Major -lt 9) { throw '.NET 9 target-ını build edə bilən SDK (9 və ya daha yeni) tələb olunur.' }
    Run dotnet @('restore','Kiberaz.sln')
    Run dotnet @('build','Kiberaz.sln','-c','Release','--no-restore','--warnaserror')
    $auditText=(& dotnet list Kiberaz.sln package --vulnerable --include-transitive --format json | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'NuGet audit aləti işləmədi.' }
    $audit=$auditText | ConvertFrom-Json
    foreach ($project in $audit.projects) {
        foreach ($framework in $project.frameworks) {
            foreach ($package in @($framework.topLevelPackages)+@($framework.transitivePackages)) {
                if ($package.vulnerabilities) { throw "NuGet vulnerability: $($package.id)." }
            }
        }
    }
    # Debug artifacts layout import worker üçün harness müqaviləsidir.
    Run dotnet @('run','--project','tools/SecurityRegressionTests/SecurityRegressionTests.csproj','--artifacts-path','tools/SecurityRegressionTests/.artifacts')
    [IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
    $publish=Join-Path $OutputDirectory 'publish'
    Run dotnet @('publish','Kiberaz.Api/Kiberaz.Api.csproj','-c','Release','--no-build','-o',$publish)
    if (-not (Test-Path -LiteralPath (Join-Path $publish 'seed-data/quiz-questions.json'))) { throw 'Publish seed sualları yoxdur.' }
    # Qadağan olunmuş config-i sonradan silmirik: standart publish pozulubsa gate qırmızı olmalıdır.
    & (Join-Path $PSScriptRoot 'Test-ReleaseConfiguration.ps1') -PublishPath $publish -EvidencePath (Join-Path $OutputDirectory 'release-config-check.json')
    $uiBuild=Join-Path ([IO.Path]::GetTempPath()) ('kiberaz-ui-release-'+[guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($uiBuild) | Out-Null
    $uiSource=Join-Path $root 'kiberaz-ui'
    foreach ($item in Get-ChildItem -LiteralPath $uiSource -File | Where-Object { $_.Name -notlike '.env*' -and $_.Extension -in '.json','.ts','.js','.html' }) {
        Copy-Item -LiteralPath $item.FullName -Destination $uiBuild
    }
    foreach ($directory in @('src','public')) { Copy-Item -LiteralPath (Join-Path $uiSource $directory) -Destination $uiBuild -Recurse }
    foreach ($item in Get-ChildItem Env: | Where-Object Name -like 'VITE_*') { Remove-Item -LiteralPath ('Env:'+$item.Name) }
    foreach ($key in $publicSettings.Keys) { Set-Item -LiteralPath ('Env:'+$key) -Value $publicSettings[$key] }
    Set-Location $uiBuild
    Run npm @('ci','--no-audit','--no-fund')
    Run npm @('run','check')
    Run npm @('run','build')
    $html=Get-Content -LiteralPath (Join-Path $uiBuild 'dist/index.html') -Raw
    if ($html -notmatch 'https://api\.kiberaz\.az' -or $html -match 'localhost|127\.0\.0\.1') { throw 'Frontend CSP production API ilə uyğun deyil.' }
    Copy-Item -LiteralPath (Join-Path $uiBuild 'dist') -Destination $OutputDirectory -Recurse
    Get-ChildItem -LiteralPath $OutputDirectory -Recurse -File | ForEach-Object {
        [pscustomobject]@{path=[IO.Path]::GetRelativePath($OutputDirectory,$_.FullName);sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'manifest.json')
    Write-Host "PASS: $OutputDirectory/publish və $OutputDirectory/dist hazırdır. Bu lokal gate-dir; server/provider smoke hələ tələb olunur." -ForegroundColor Green
} finally {
    foreach ($item in Get-ChildItem Env: | Where-Object Name -like 'VITE_*') { Remove-Item -LiteralPath ('Env:'+$item.Name) }
    foreach ($key in $savedVite.Keys) { Set-Item -LiteralPath ('Env:'+$key) -Value $savedVite[$key] }
    Set-Location $previousLocation
}
