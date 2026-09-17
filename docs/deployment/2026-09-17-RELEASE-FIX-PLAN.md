# Release düzəlişləri — icra planı

Məqsəd: auditdəki BUG-001..006-nı bağlamaq, mövcud arxitekturanı saxlayaraq təkrar yoxlanmış release paketi və ilk server üçün yol xəritəsi hazırlamaq. İstifadəçi auditin remediation təkliflərindən sonra bütün düzəlişlərə icazə verib. Canlı server alışı/deploy bu mərhələdə edilmir.

## Sərhədlər

.NET9/LiteDB/React/Vite saxlanır. Məxfi dəyərlər loga düşmür. Real DB və əvvəlki istifadəçi prosesləri istifadə edilmir. Əvvəlki QA sübutları dəyişdirilmir. Commit/push yoxdur. Yeni testlər ayrıca sintetik data ilə işləyir.

## Tapşırıqlar

- [x] Frontend: ExamSession taymer baseline/effect və submit lifecycle; authService memory-only token, refresh/logout race; LoginModal resend; Modal focus. Mövcud browser FAIL reproduksiyaları əsasında regression, typecheck/lint.
- [x] Backend: qorunan owner self profile rəddi `SetUserNameAsync`-dən əvvəl; HTTP + DB readback regression və adi rol control-ları.
- [x] Release config: Local JSON yalnız Development, publish exclusion; sentinel config/startup/publish regression; real məxfi faylın dəyərini çıxarmamaq.
- [x] Deploy automation: mövcud shell/PowerShell/template-ləri yoxlamaq; backup stop/copy/restart, first-deploy symlink, rollback və fail-fast problemlərini düzəltmək; mümkün local syntax/harness yoxlamaları.
- [x] Junior roadmap: 10–20 EUR aylıq büdcə, rəsmi cari provider mənbələri; DNS/TLS/SSH/firewall/secrets/mail/CAPTCHA/backup/publish/smoke/rollback addımları və izahları.
- [x] Yekun: təhlükəsizlik diff review; .NET Release warn-as-error, security regression suite, frontend build/lint; clean publish; izolə browser/API fix-verification; real provider/host addımlarını və əvvəlki geniş QA matrisinin yoxlanmamış sərhədlərini dəqiq qeyd etmək.

Əvvəlki auditin 191 NOT_RUN sətri 191 bug demək deyil. “Bütün bug-lar” təsdiqlənmiş altı qüsur və bu düzəliş/deploy yolunda təkrar alınan yeni qüsurlar deməkdir; yoxlanmamış bütün scope-a blanket PASS verilmir.
