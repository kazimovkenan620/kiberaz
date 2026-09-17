# Release düzəlişlərinin təkrar yoxlanması

Bu alətlər 17.09.2026 tarixli düzəlişlər üçün ayrıca sintetik mühitdir. Production bazası və mövcud development serveri istifadə edilmir. Nəticələr `docs/deployment/evidence-2026-09-17/` qovluğundadır. Əvvəlki audit alətləri `tools/PreDeployQa/` daxilində saxlanılıb.

## Əsas gate

Repo kökündə PowerShell 7 ilə:

```powershell
pwsh -File deploy/predeploy-check.ps1
```

Bu əmr öz ictimai Turnstile site key-in yazılmış `kiberaz-ui/.env.production` faylını gözləyir. Yalnız lokal namizəd üçün `-FrontendEnvPath kiberaz-ui/env.production.example` istifadə edilə bilər; həmin nümunə key-in sahibliyi və provider işi bununla yoxlanmır. Hər run yeni `artifacts/releases/` qovluğu yaradır. Build, 528 təhlükəsizlik assertion-u, NuGet audit, 5 fail-closed konfiqurasiya sınağı, təcrid edilmiş `npm ci`, frontend check/audit/build və publish manifesti bu gate-ə daxildir.

Frontend-in idarə olunan şəbəkə/saat sınaqlarının əmrləri `kiberaz-ui/tests/README.md` daxilindədir. Shell sınaqları ayrıca WSL/Linux-da `bash deploy/tests/deployment-regression.sh` ilə işləyir; bunlar saxta xidmət əmrləri və müvəqqəti yollarla işləyən 14 ssenaridir, real serverin işlədiyini sübut etmir.

## Real brauzer + lokal API

`prepare-fixture.ps1` əvvəlki QA seed məntiqindən istifadə edib yeni private temp mühiti yaradır. Mövcud `runtime` varsa onu əvəz etmədən dayanır. `browser-api.cjs` hazırda bu run-a bağlıdır:

- private kök: `%TEMP%/kiberaz-releasefix-20260917`;
- API: `http://localhost:5259`, ayrıca Development content root `runtime/`;
- UI: `http://localhost:5189`, production Vite build, API URL `http://localhost:5259/api`;
- testdə Chrome və əvvəlki QA quraşdırmasındakı Playwright istifadə edilir;
- private `accounts.json` sintetik hesabları saxlayır; parol/token/header dəyərləri sübuta yazılmır;
- real SMTP söndürülüb; resend HTTP 200 poçtun çatdırılmasını sübut etmir.

Təkrar işə salmazdan əvvəl portları və prosesin content root-unu təsdiqlə. Başqa run üçün fixture ID, Playwright yolu, portlar və output yolları birlikdə uyğunlaşdırılmalıdır. Alət hazır tətbiqə istifadəçi daxil edir, sintetik imtahan yaradır və profil control-unu dəyişir; onu production-a yönəltmə.

```powershell
pwsh -File tools/ReleaseVerification/prepare-fixture.ps1
# Yalnız yeni fixture üçün; mövcud mühitdə bu setup-u təkrarlama.
# Təcrid edilmiş API və localhost üçün build edilmiş UI hazır olduqdan sonra:
node tools/ReleaseVerification/browser-api.cjs
```

Altı ssenari: yaddaş tokeni/reload/yeni tab; resend; modal klaviatura/fokus; qorunan owner profilinin HTTP rəddi və readback; həqiqi 1 dəqiqəlik imtahan/auto-submit/50% scoring; logout. Tam run təxminən 1–2 dəqiqə çəkir. Gələcək run əvvəlki sübutları əvəz etməmək üçün output qovluğunu ayrıca seçməlidir.

`verify-artifacts.py` yeni mətn sübutlarında məlum məxfi dəyərləri yoxlayır, hazır paketin manifestini təsdiqləyir və dəyişən mənbə fayllarının SHA-256 snapshot-ını saxlayır. Bu, ümumi secret scanner və tam QA əvəzi deyil; screenshot-lar ayrıca vizual yoxlanır.
