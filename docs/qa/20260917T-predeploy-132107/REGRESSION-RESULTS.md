# Təhlükəsizlik regressiya sınaqlarının nəticəsi

**PASS — 516/516 assertion, 29 imtiyazlı marşrut, çıxış kodu 0.** Mövcud sınaq dəsti bir dəfə icra edildi. Mənbə kodu, test fikstürləri və mövcud tətbiq verilənlər bazası dəyişdirilmədi.

- Başlanğıc: 2026-09-17 09:22:47 UTC (13:22:47 Asia/Baku).
- Son: 2026-09-17 09:23:50 UTC (13:23:50 Asia/Baku).
- Müddət: təxminən 63 saniyə.
- Əmr: `dotnet run --project tools/SecurityRegressionTests/SecurityRegressionTests.csproj --artifacts-path tools/SecurityRegressionTests/.artifacts`.
- Sübut: [security-regression.txt](evidence/security-regression.txt).

## İzolyasiya

İcradan əvvəl harness mənbəyi yoxlanıldı. `Program.cs:44` unikal müvəqqəti qovluq yaradır; `:54` yeni sintetik LiteDB faylına qoşulur; `:106–125` yalnız loopback ünvanında ayrıca gizli API prosesi başladır; `:496–508` yalnız öz prosesini dayandırır və yol yoxlamasından sonra öz müvəqqəti qovluğunu silir. Mövcud DB açılmır. Import aləti də yalnız həmin sintetik DB üçün çağırılır (`RemediationTests.cs:109`). Hesab xidmətlərində e-poçt göndərilməsi yaddaşda tutulan test əvəzedicisi ilə aparılır (`RemediationTests.cs:240–252`).

Yalnız bu əmr prosesində `DataProtection__KeysPath=qa-keys` təyin edildi. API-nin nisbi yol qaydası (`Kiberaz.Api/Program.cs:536–545`) açarları harness-in müvəqqəti content root qovluğuna yönəldir; mövcud istifadəçi açar anbarına ehtiyac qalmır. Daimi konfiqurasiya dəyişdirilmədi. Çıxış sübuta yazılmazdan əvvəl e-poçt/JWT/uzun hexadecimal dəyərlər üçün redaksiya tətbiq edildi.

## Yoxlanmış sərhədlər

| Sahə | Mövcud suite-in əhatəsi |
| --- | --- |
| Admin giriş nəzarəti | Reflection ilə tapılan 29 imtiyazlı marşrut: anonim sorğular, User/Teacher/Moderator/VIP rolları, header/query vasitəsilə rol saxtalaşdırılması; düzgün admin nəzarət ssenariləri |
| JWT və hesab vəziyyəti | İmza, alqoritm, issuer/audience, müddət, subject/stamp, hesabın bloklanması/silinməsi, köhnəlmiş rollar; profil/login overposting |
| Sessiyalar | Paralel refresh, rotasiya və grace-window sonrası replay, cookie-only refresh, çoxcihazlı sessiyalar, logout, rol dəyişikliyindən sonra ləğv |
| Tək administrator qaydası | Qorunan hesabın dəyişdirilməsinin rəddi, siyahı və statistikada gizlədilməsi, icazəsiz Admin rolunun təmizlənməsi, köhnə sənəd yazısının rəddi |
| Quiz və imtahan | İlk cavabın qorunması, paralel replay/score inflation, açıq və qapalı sual bankı sərhədi, import, VIP sessiya limiti, qapalı imtahanın qiymətləndirilməsi, köhnə sessiyanın rəddi |
| Hesab bərpası | Saxta reset tokenləri hesabı dəyişmir; düzgün bərpa, tokenin təkrar istifadəsi, köhnə/yeni poçt ünvanının təsdiqi |
| Fayl/PDF | Ümumi və hesab kvotası, real axın həcmi, ayrı sanitizer prosesi, aktiv/sıxılmış/şifrəli/pozulmuş PDF, qanuni upload/download nəzarətləri |
| Google kod mübadiləsi | Sintetik birdəfəlik kodların müddət, replay və hesab vəziyyəti nəzarətləri |

## Məhdudiyyətlər

Bu, brauzerdə tam E2E sınağı deyil. Real API-nin Development pipeline-ı və bir sıra birbaşa servis çağırışları birlikdə yoxlanılıb. Reflection əhatəsi `AdminController` və `QuizController` daxilində admin marşrutları ilə məhduddur (`Program.cs:565–586`); bütün endpoint-lərin tam əhatəsi kimi təqdim edilmir. 516 sayı assertion sayıdır, 516 ayrıca istifadəçi axını demək deyil.

Production HTTPS/HSTS, reverse proxy/TLS/CDN, yerləşdirilmiş CORS davranışı, production rate-limit hədləri, real CAPTCHA, real Google OAuth və SMTP çatdırılması bu icra ilə sübut olunmur. Development-də cookie Secure şərti və rate-limit parametrləri fərqlidir. UI əlçatanlığı, frontend brauzer axınları, real baza/seed məzmunu və bütün rol/mülkiyyət kombinasiyaları bu nəticədən çıxarıla bilməz.

README-dəki 267/267 və 15 marşrut rəqəmləri köhnə yoxlamaya aiddir; cari faktiki nəticə 516/516 və 29-dur. `AGENTS.md`-nin göstərdiyi `.codex/roles/bug-hunter-reviewer.md` və `.codex/skills/kiberaz-engineering/SKILL.md` faylları bu checkout-da yoxdur; gizli fayllar daxil repo axtarışı da onları tapmadı. Bu sınaq üçün təqdim edilmiş layihə qaydaları, `SENIOR-RULES.md`, README və harness mənbəyi əsas götürüldü.

## Son baza yoxlamasının təkrar icrası

İstifadəçinin yekun kritik yoxlamaları yenidən icra etmək tələbi ilə həmin komanda yeni təcrid edilmiş sintetik mühitdə təkrar işə salındı. **PASS — 516/516 assertion, 29 imtiyazlı marşrut, exit 0.** Başlanğıc 2026-09-17 09:42:57 UTC, son 09:43:44 UTC; təxminən 47 saniyə. Sübut: [security-regression-final.txt](evidence/security-regression-final.txt). Yalnız prosesə aid `DataProtection__KeysPath=qa-keys` saxlanıldı; əsas audit runtime bazası açılmadı və kod dəyişdirilmədi. Yuxarıdakı əhatə məhdudiyyətləri bu təkrar icraya da aiddir.
