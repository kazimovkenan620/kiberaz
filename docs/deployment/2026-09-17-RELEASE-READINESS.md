# Kiberaz.az — düzəlişlərdən sonra buraxılış vəziyyəti

**17.09.2026: aşkar edilmiş 6 audit qüsuru düzəldildi, əlavə 4 regressiya yolu bağlandı və lokal buraxılış gate-i keçdi.** Serverin qurulması və real provayder yoxlamaları hələ aparılmayıb. Bu nəticə ictimai açılışa qeyd-şərtsiz GO və ya bütün mümkün xətaların yoxluğuna zəmanət deyil.

İcra kökü: `C:\Users\User\Desktop\kiberaz`; branch `feat/ui-migration-light-dark`; baza commit `2a3f32f4e131fda77d668215c4ea83af20a6f8b5`. Düzəlişlər working tree-dədir, commit/push edilməyib. Əvvəlki audit materialları saxlanılıb. İstifadəçinin son düzəliş tələbi əvvəlki audit-only məhdudiyyətini bu mərhələ üçün dəyişib.

## Hansı qüsurlar bağlandı?

| Qüsur | Düzəliş və faktiki nəticə |
|---|---|
| BUG-001 — imtahan taymeri donurdu | Monoton deadline, sabit effect və tək auto-submit. Real API ilə taymer 60→54 azaldı; vaxt bitəndə bir submit, 2/4 düzgün cavaba 50% nəticə. Gecikmiş answer sorğusuna gözləmə 2 saniyə ilə məhdudlaşdırıldı; sonradan gələn snapshot yekun nəticəni geri çevirmir. |
| BUG-002 — lokal config publish-ə düşürdü | Local JSON yalnız Development-da oxunur; standart publish Local/Development/example config və DB/uploads-u çıxarmır. Production/Staging zəhərlənmiş Local JSON-u oxumadı, səhv CAPTCHA ilə start rədd edildi. |
| BUG-003 — access token sessionStorage-da idi | Token modul yaddaşındadır. Cookie ilə reload/yeni tab bərpası işləyir. Köhnə cavab yeni girişi silmir və başqa hesabla sorğunu təkrarlamır. Eyni sessiya refresh paylaşır, yeni sessiya köhnə pending refresh-dən ayrılır. |
| BUG-004 — resend düyməsi görünmürdü | Göstərilmə lokal səhv mətnindən asılı deyil; təsdiqsiz login-dən sonra CTA və real endpoint 200 yoxlandı. 429 mesajı ayrıca yoxlandı. SMTP çatdırılması ayrıca server gate-idir. |
| BUG-005 — owner öz profilini dəyişə bilirdi | `UserService` qorunan hesabı ilk persist əməliyyatından əvvəl rədd edir. Ad və nickname cəhdləri 400, DB readback dəyişməz. User/Teacher/VIP/Moderator profil yeniləməsi control-ları keçir. |
| BUG-006 — Escape-dən sonra fokus itirdi | Açan element düzgün saxlanır; Tab trap, Escape, auth pəncərələri arasında keçid, iç modal və silinmiş trigger halları yoxlandı. |

Müstəqil kod baxışından gələn əlavə yollar ayrıca RED→GREEN ilə təsdiqləndi: gecikmiş refresh-in yeni sessiyanı silməsi; Google callback ilə bootstrap refresh yarışması; ilişmiş answer-in deadline submit-i dayandırması; faktiki HTTP 400 invalid-refresh cavabından sonra sessiya işarəsinin qalması.

Təhlükəsizlik baxımından lokal sirlərin buraxılışa daşınma yolu bağlandı; qorunan sahib hesabının self-service dəyişiklik yolu serverdə bağlandı; tokenin persistent storage-da qalması aradan qaldırıldı. JWT doğrulama, refresh rotasiyası, CAPTCHA fail-closed, CORS və mövcud rol siyasətləri zəiflədilmədi.

## İcra edilmiş yoxlamalar

| Yoxlama | Nəticə | Sübut |
|---|---|---|
| Backend Release, `--warnaserror` | PASS, 0 warning / 0 error | [yekun gate](evidence-2026-09-17/predeploy-final.txt) |
| Təhlükəsizlik regressiyaları | **528/528** | [yekun gate](evidence-2026-09-17/predeploy-final.txt) |
| Konfiqurasiya/publish | **5/5**, yanlış production config start etmir | [release config](../../artifacts/releases/20260917-161219-647464fc/release-config-check.json) |
| Frontend TypeScript + tam ESLint + npm audit + build | PASS; npm audit 0 vulnerability | [yekun gate](evidence-2026-09-17/predeploy-final.txt) |
| NuGet audit | Gate keçdi, aşkar edilmiş vulnerability yoxdur | [gate skripti](../../deploy/predeploy-check.ps1) |
| Chrome, idarə olunan şəbəkə və saat | **15/15**, unhandled pageerror yoxdur | [regressiya çıxışı](evidence-2026-09-17/frontend-regressions.txt) |
| Chrome + həqiqi ayrıca API/DB + production UI build | **6/6** | [nəticələr](evidence-2026-09-17/browser-api-fixes.json), [redaktə edilmiş şəbəkə statusları](evidence-2026-09-17/browser-api-network.json) |
| Deploy/backup/rollback harness, WSL | **14/14** | [shell çıxışı](evidence-2026-09-17/deployment-shell.txt) |
| Release üçün kopyalanan frontend mənbəyi | 75 fayl, 0 fərq | [hash müqayisəsi](evidence-2026-09-17/frontend-release-source-match.json) |
| Roadmap əmrlərinin sintaksisi | 7 PowerShell və 25 Bash bloku PASS | Agentin parser/bash-n yoxlaması; real host icrası deyil |

Başlanğıc owner regressiyası düzəlişdən əvvəl **525/528** idi; üç assertion qüsuru təsdiqlədi ([RED](evidence-2026-09-17/security-red.txt)). İlk real browser run-da resend üçün geniş `status` selector-u bir neçə element tapdı; locator dialog daxilinə daraldıldı, ilkin sübut saxlanıldı, yekun tam run 6/6 keçdi. İlk tam gate-də bir startup probe gözlənilən diaqnostikanı versə də Windows prosesi 30 saniyədə çıxmadı; səbəb təsdiqlənməyib. Timeout və assertion zəiflədilmədən eyni paket üzərində 5/5 təkrar, sonra yekun tam gate keçdi. [İlkin gate](evidence-2026-09-17/predeploy-gate.txt), [təkrar](evidence-2026-09-17/release-config-repeat.json).

Screenshot-lar vizual yoxlandı: [imtahan nəticəsi](evidence-2026-09-17/fixed-deadline-result.png), [resend](evidence-2026-09-17/fixed-resend.png), [reload-dan sonra sessiya](evidence-2026-09-17/fixed-login-reload.png). Parol/token/cookie göstərilmir. Yalnız sintetik hesablar və ayrıca müvəqqəti DB istifadə edilib; SMTP çatdırılması söndürülüb.

## Hazır paket və dəyişən fayllar

Lokal namizəd paket:

`C:\Users\User\Desktop\kiberaz\artifacts\releases\20260917-161219-647464fc`

İçində `publish/`, `dist/`, `manifest.json`, `release-config-check.json` var. Frontend paketində production API URL və repodakı nümunə ictimai Turnstile key istifadə edilib. **Key-in öz widget-inə aid olduğunu təsdiqlə, `.env.production` hazırla və serverə göndəriləcək final paketi yenidən yarat.** Lokal browser sınağı eyni mənbədən localhost API və rəsmi test CAPTCHA key ilə ayrıca build olunub.

Əsas dəyişikliklər:

- `Kiberaz.Api/Program.cs`, `Kiberaz.Api/Kiberaz.Api.csproj`: mühit və publish sərhədi.
- `Kiberaz.Infrastructure/Services/UserService.cs`: qorunan sahib profilinin rəddi.
- `kiberaz-ui/src/components/ExamSession.tsx`: taymer, answer/submit ardıcıllığı və nəticə.
- `kiberaz-ui/src/services/authService.ts`, `apiClient.ts`, `src/App.tsx`, `components/Navbar.tsx`: yaddaş tokeni və sessiya lifecycle.
- `kiberaz-ui/src/components/auth/LoginModal.tsx`, `components/ui/Modal.tsx`: resend və fokus.
- `.gitattributes`, `deploy/common.sh`, `deploy.sh`, `backup.sh`, `kiberaz-api.service`: LF, tək maintenance lock, offline backup, API+UI birlikdə rollback, məhdud yazı yolları.
- `deploy/nginx-api.conf.example`, `kiberaz-ui/deploy/nginx-spa.conf.example`: Ubuntu 24.04 sintaksisi, ACME, query-siz access log.
- `deploy/predeploy-check.ps1`, `Test-ReleaseConfiguration.ps1`, `kiberaz-api.env.example`: təmiz paket və sintetik startup gate, SMTP 587 şablonu.
- `tools/SecurityRegressionTests/PreDeployReleaseTests.cs` və `Program.cs`, `kiberaz-ui/tests/`, `deploy/tests/`, `tools/ReleaseVerification/`: təkrar icra edilə bilən regressiyalar.

Paket hash-ləri manifestdə, dəyişmiş mənbə hash-ləri [source snapshot](evidence-2026-09-17/source-sha256.json), məxfilik/manifest/dependency yoxlaması [artifact verification](evidence-2026-09-17/artifact-verification.json) daxilindədir. Dependency manifest və lockfile versiyaları dəyişdirilməyib. [Git diff whitespace yoxlaması](evidence-2026-09-17/final-hygiene.txt) keçdi. Öz QA serverlərimiz dayandırıldı; istifadəçinin 5173/5251 prosesləri saxlanıldı ([proses nəticəsi](evidence-2026-09-17/process-cleanup.json)).

## Açılışdan əvvəl qalan real addımlar

1. Domen/DNS və sabit sahib poçtuna giriş təsdiqlənməlidir; server hələ alınmayıb.
2. Öz Turnstile widget-i, hostname-ləri və backend secret-i; SMTP 587, təsdiqlənmiş sender, real confirmation/reset məktubu yoxlanmalıdır. Google girişini təqdim ediriksə real OAuth redirect/exchange də sınaqdan keçməlidir.
3. VPS-də cari .NET 9 patch, Nginx, systemd, SSH/firewall, daimi data/keys/uploads yolları hazırlanmalıdır. Lokal WSL-də Nginx yoxdur; real `nginx -t` və systemd start burada yoxlanmayıb.
4. HTTPS/CORS/cookie, public health, owner bootstrap və əsas istifadəçi axınları serverdə yoxlanmalıdır.
5. Offline backup, şifrəli xarici nüsxə, təcrid edilmiş restore və restart sonrası məlumatın qalması faktiki təsdiqlənməlidir.
6. Əvvəlki tam QA matrisi ayrıca natamamdır: ilkin 273 sətrin 191-i NOT_RUN idi; bu düzəliş yoxlamaları bütün rolların bütün ekranlarına blanket PASS vermir. Açılışa daxil edilən kurs/upload/moderasiya və digər axınların qalan sınaqları həmin matrisi əsas götürməlidir. [Əvvəlki QA hesabatı](../qa/20260917T-predeploy-132107/PRE-DEPLOY-QA-REPORT.md).

.NET 9 dəstəyi 10 noyabr 2026-da bitir; cari patch ilə deploy və noyabrdan əvvəl ayrıca .NET 10 LTS keçidi planı [yol xəritəsində](2026-09-17-BEGINNER-ROADMAP.md) göstərilib. Framework bu dəyişiklikdə yüksəldilməyib.

İcra üçün əsas sənəd: [server seçimindən backup bərpasına qədər junior yol xəritəsi](2026-09-17-BEGINNER-ROADMAP.md).
