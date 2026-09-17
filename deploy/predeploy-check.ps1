# Lokal pre-deploy yoxlaması (Windows, repo kökündən):
#   pwsh -File deploy/predeploy-check.ps1
# Hər addım uğursuz olsa skript dayanır — yaşıl bitməyən build serverə GETMƏMƏLİDİR.
# Çıxış: ./publish (API, framework-dependent) və kiberaz-ui/dist (SPA).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($name) { Write-Host "`n=== $name" -ForegroundColor Cyan }
function Fail($msg)  { Write-Host "XETA: $msg" -ForegroundColor Red; exit 1 }

Step "0. Alətlər"
dotnet --version | Out-Null
node --version   | Out-Null
$sdk = (dotnet --list-sdks | Select-String '^9\.').Count
if ($sdk -eq 0) { Fail ".NET 9 SDK tapılmadı" }

Step "1. Backend build (Release, --warnaserror — CI ilə eyni)"
dotnet restore Kiberaz.sln
dotnet build Kiberaz.sln -c Release --no-restore --warnaserror
if ($LASTEXITCODE -ne 0) { Fail "Backend build" }

Step "2. Zəiflikli NuGet paketləri (tranzitiv daxil)"
$audit = dotnet list Kiberaz.sln package --vulnerable --include-transitive 2>&1 | Out-String
Write-Host $audit
if ($audit -match 'has the following vulnerable packages') { Fail "Zəiflikli NuGet paketi var" }

Step "3. Təhlükəsizlik reqressiya testləri (ayrı proses, müvəqqəti LiteDB — real bazaya toxunmur)"
dotnet run --project tools/SecurityRegressionTests/SecurityRegressionTests.csproj -c Release -- --artifacts-path tools/SecurityRegressionTests/.artifacts
if ($LASTEXITCODE -ne 0) { Fail "SecurityRegressionTests uğursuz" }

Step "4. Production 'fail-fast' start yoxlaması (səhv konfiqurasiya ilə tətbiq QALXMAMALIDIR)"
# Test açarı ilə Production-da start → InvalidOperationException gözlənilir (CaptchaService.EnsureProductionReady).
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:JwtSettings__SecretKey = 'predeploy-check-' + [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:Captcha__SecretKey     = '1x0000000000000000000000000000000AA'
$env:DataProtection__KeysPath = Join-Path $env:TEMP 'kiberaz-predeploy-keys'
$env:ConnectionStrings__LiteDb = 'Filename=' + (Join-Path $env:TEMP 'kiberaz-predeploy.db') + ';Connection=shared'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:0'
$p = Start-Process dotnet -ArgumentList 'run','--project','Kiberaz.Api/Kiberaz.Api.csproj','-c','Release','--no-build' -PassThru -NoNewWindow -RedirectStandardError (Join-Path $env:TEMP 'kiberaz-predeploy.err')
if (-not $p.WaitForExit(60000)) { $p.Kill(); Fail "Tətbiq test CAPTCHA açarı ilə Production-da QALXDI — fail-fast yoxlaması işləmir" }
$err = Get-Content (Join-Path $env:TEMP 'kiberaz-predeploy.err') -Raw
if ($err -notmatch 'TEST acaridir') { Write-Host $err; Fail "Gözlənilən CAPTCHA xətası görünmədi" }
Write-Host "OK — test açarı ilə start rədd edildi" -ForegroundColor Green
Remove-Item Env:ASPNETCORE_ENVIRONMENT, Env:JwtSettings__SecretKey, Env:Captcha__SecretKey, Env:DataProtection__KeysPath, Env:ConnectionStrings__LiteDb, Env:ASPNETCORE_URLS -ErrorAction SilentlyContinue

Step "5. Publish (framework-dependent, single-file DEYİL — PDF worker eyni DLL-i ayrıca prosesdə açır)"
if (Test-Path publish) { Remove-Item publish -Recurse -Force }
dotnet publish Kiberaz.Api/Kiberaz.Api.csproj -c Release -o publish --no-build
if ($LASTEXITCODE -ne 0) { Fail "Publish" }
Remove-Item publish/appsettings.Development.json -ErrorAction SilentlyContinue   # Captcha bypass bayrağı orada
Remove-Item publish/appsettings.Local.json       -ErrorAction SilentlyContinue   # lokal sirlər
Remove-Item publish/appsettings.Local.example.json -ErrorAction SilentlyContinue
if (-not (Test-Path publish/seed-data/quiz-questions.json)) { Fail "publish/seed-data yoxdur — QuizSeeder boş baza ilə açılar" }
if (Test-Path publish/Kiberaz.db) { Fail "publish içində Kiberaz.db var — development bazası serverə getməməlidir" }
Get-ChildItem publish -Filter 'appsettings*.json' | ForEach-Object { Write-Host "  $($_.Name)" }

Step "6. Frontend (tsc + eslint + audit + production build)"
Set-Location kiberaz-ui
if (-not (Test-Path .env.production)) { Fail ".env.production yoxdur — env.production.example-dən kopyala (VITE_API_URL=https://api.kiberaz.az/api)" }
$envProd = Get-Content .env.production -Raw
if ($envProd -match 'localhost|127\.0\.0\.1') { Fail ".env.production lokal ünvana yönəlib" }
if ($envProd -match '1x00000000000000000000AA') { Fail ".env.production Turnstile TEST site key ilə" }
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm ci" }
npm run check
if ($LASTEXITCODE -ne 0) { Fail "tsc / eslint / npm audit" }
npm run build
if ($LASTEXITCODE -ne 0) { Fail "vite build" }
$html = Get-Content dist/index.html -Raw
if ($html -notmatch 'https://api\.kiberaz\.az') { Fail "dist/index.html CSP-də api.kiberaz.az yoxdur" }
if ($html -match 'localhost') { Fail "dist/index.html-də localhost qalıb" }
if (-not (Test-Path dist/_headers)) { Fail "dist/_headers yoxdur" }
Set-Location $root

Write-Host "`nHAMISI YAŞIL. Serverə gedəcək: ./publish  və  kiberaz-ui/dist" -ForegroundColor Green
Write-Host "Növbəti: deploy/deploy.sh (serverdə) — bax docs/PRODUCTION-ROADMAP.md" -ForegroundColor Green
