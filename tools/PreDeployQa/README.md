# İzolyasiya olunmuş predeploy QA fikstürü

Bu köməkçi yalnız `20260917T-predeploy-132107/runtime` adlı OS müvəqqəti qovluğunda sintetik baza yaradır. Production koduna dəyişiklik etmir, API başlatmır və e-poçt göndərmir. Mövcud qovluq məzmunu olduqda `init` rədd edilir; avtomatik silmə yoxdur.

```powershell
dotnet run --project tools/PreDeployQa/PreDeployQa.csproj --artifacts-path tools/PreDeployQa/.artifacts -- init C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/runtime
```

`accounts.json` yalnız müvəqqəti qovluqda saxlanılır: `{accounts:[{alias,id,email,password,role,nickname}],categories:{publicId,examId}}`. Onu, `appsettings*.json`, `tokens.private.json`, DB və DataProtection açarlarını loga/repozitoriyaya köçürməyin. Sirrsiz `fixture-manifest.json` hesabatda istifadə oluna bilər. Sualların 1–4 ardıcıllığının sintetik düzgün variantları müvafiq olaraq A–D-dir.

`tokens.private.json` ilkin UserA/UserB/Unconfirmed hesabları üçün təsdiq və şifrə sıfırlama tokenlərini saxlayır. `kiberaz` DataProtection application name və API ilə eyni fikstür açar qovluğu istifadə olunur. SecurityStamp dəyişdikdən sonra köhnə token işləməyə bilər.

API-ni koordinator `Development` mühitində bu qovluğu content root verərək başladır. Yalnız bu sandbox konfiqurasiyasını istifadə etmək üçün irsi environment overrides ayrıca idarə olunmalıdır. Konfiqurasiya localhost:5259 API və localhost:5189 UI üçündür; mövcud tətbiqin prosesi və bazası istifadə olunmur. SMTP loopback port 9-dur. CAPTCHA bypass flag söndürülüdür, rəsmi [Cloudflare test secret](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) istifadə olunur; bu production CAPTCHA sübutu deyil.

API dayandırıldıqdan sonra yalnız bu sintetik DB üçün offline read-only baxış:

```powershell
dotnet tools/PreDeployQa/.artifacts/bin/PreDeployQa/debug/PreDeployQa.dll inspect C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/runtime
```

`inspect` LiteDB `ReadOnly=true` istifadə edir, yalnız collection sayları və sirrsiz hesab vəziyyəti çıxarır. `LiteDbContext` konstruktorunun indeks yazılarını çağırmır. API işləyərkən bu əmri icra etməyin.

## Bu run-ın təkrar baxışı

Bu tooling bir audit snapshot-ına bağlıdır, ümumi idempotent CI suite deyil. Mövcud fixture artıq dəyişib: reset/confirmation/course credit/exam state ilkin haldan fərqlidir. `init` mövcud qovluğu qoruyur. Yeni tam run üçün yeni RUN_ID və ayrıca temp yolunu test-only allow-list və skript sabitlərində uyğunlaşdırın; mövcud bazanı silməyin.

İcra zamanı ayrıca temp/ui qovluğuna tracked frontend faylları köçürülüb və `npm ci` edilib. Preview production build-dir. API publish release çıxışıdır. Aşağıdakı əmrləri ayrı foreground terminallarda işlətmək olar; yalnız bu audit yolları üçündür:

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:DOTNET_ENVIRONMENT='Development'
dotnet C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/publish/Kiberaz.Api.dll --contentRoot C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/runtime --urls http://localhost:5259
```

Runtime/wwwroot qovluğu API startından əvvəl mövcud olmalıdır. Host environment-dən gələn config overrides production sirrlərinə yönəlməməlidir. Bütün faktiki endpoint-lər localhost:5259/5189 ilə məhdudlaşdırılıb. Publish-dəki `appsettings.Local.json` BUG-002 sübutudur və məxfidir; onu paylaşmayın. Runtime contentRoot ayrıca sintetik config istifadə edir.

```powershell
# temp/ui daxilində build
$env:VITE_API_URL='http://localhost:5259/api'
$env:VITE_ALLOW_LOCAL_API='1'
$env:VITE_TURNSTILE_SITE_KEY='1x00000000000000000000AA'
npm run build
node C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/ui/node_modules/vite/bin/vite.js preview --host localhost --port 5189 --strictPort
```

Browser tooling ayrıca temp/browser-tooling qovluğunda `npm install playwright@1.58.2 --no-save --package-lock=false` ilə hazırlanıb; quraşdırılmış Chrome channel istifadə edilir. Repo dependency/lockfile dəyişmir. İlk təzə fixture üçün QA skript ardıcıllığı:

```powershell
$env:PYTHONIOENCODING='utf-8'
python tools/PreDeployQa/audit-api.py
node tools/PreDeployQa/browser-audit.cjs
# Bu nöqtədə yalnız audit API-ni Ctrl+C ilə dayandırıb yuxarıdakı komanda ilə yenidən başladın.
# EXT-009 özü restart ETMİR; əvvəlki result/class readback-unu ölçür.
python tools/PreDeployQa/audit-extended.py
python tools/PreDeployQa/audit-boundaries.py
node tools/PreDeployQa/browser-audit.cjs --roles
python tools/PreDeployQa/final-smoke.py
```

Tarixi run-da harness düzəlişləri və seçilmiş scenario təkrarları olub; raw ilk nəticələri saxlayırıq. Buna görə bu ardıcıllığın indiki mutation olunmuş fixture-də tam PASS verməsi gözlənilmir. `--retest` exam/focus subset-dir; `--callbacks` yalnız mənfi callback-lər; `--deadline` ayrıca bir dəqiqəlik təzə sessiya və temp/runtime/timer-session.private.json setup tələb edir. Həmin JSON host create API cavabıdır, secret/tokens saxlamır. Köhnə expired sessiyanı bu sınaq üçün istifadə etməyin. Bug repro addımları QA-BUGS.md-dədir.

Browser FAIL JSON-a açıq yazılır; son tooling FAIL zamanı exit 1, BLOCKED zamanı exit 2 qaytarır. Əvvəlki evidence run-larında exit 0 olsa belə JSON FAIL-ləri authoritative-dir. Digər API helper-lərdə də ayrı assert nəticələri JSON-dadır; yalnız proses exit code-u ilə PASS qərarı verməyin.

```powershell
# Read-only report assembly; yeni test deyil
python tools/PreDeployQa/finalize-report.py
```

Generator yalnız bu snapshot üçün nəzərdə tutulub: gate/suite/DB nəticələri yoxlanmış sabit qiymətləndirmələrdir, API/browser nəticələri JSON-dan alınır; bütün saylar yekun matrisdən hesablanır. Yeni sübut və ya yeni run üçün sabit qiymətləndirmələri təkrar yoxlayın.

Cleanup: yalnız öz açdığınız terminallarda Ctrl+C istifadə edin. PID ilə dayandırmazdan əvvəl commandline-ın bu RUN_ID temp yoluna aidliyini yoxlayın. Bu run-da API/UI artıq dayandırılıb, sintetik DB/uploads/keys/credentials saxlanıb. 5251/5173-də istifadəçinin əvvəlki serverlərinə toxunmayın. Raw private konfiqurasiya/log/credential və auth state-i docs-a köçürməyin.
