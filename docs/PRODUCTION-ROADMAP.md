# Kiberaz.az — Production Roadmap (2026-09-14)

Hədəf topologiya: **tək Ubuntu server** (nginx + Kestrel + LiteDB), üç host:
`kiberaz.az` (SPA, `www` → apex), `api.kiberaz.az` (API, `127.0.0.1:5000` arxasında).

Bu sənəd `DEPLOY-CHECKLIST.md`-i əvəz edir. Hər faza sıra ilə gedir; 🔴 = deploy-u bloklayır,
🟠 = ilk gün, 🟡 = ilk həftə, 🔵 = launch-dan sonra.

---

## 0. Son testlər — nə yoxlanıldı, nəticə nədir

| Yoxlama | Nəticə |
|---|---|
| `npm ci` (lock faylı ilə) | ✅ |
| `tsc -b` | ✅ 0 xəta |
| `eslint .` | ✅ 0 xəta |
| `npm audit` (prod + dev, `moderate`) | ✅ 0 zəiflik |
| `vite build` — **real production env** ilə (`VITE_API_URL=https://api.kiberaz.az/api`) | ✅ 1.0 s; `index-*.js` 466 KB (gzip 128 KB), CSS 102 KB (gzip 18 KB) |
| `dist/index.html` CSP | ✅ `connect-src/img-src` → `https://api.kiberaz.az`, `upgrade-insecure-requests`, inline skript yoxdur, `localhost` yoxdur |
| `dist/_headers`, `theme-init.js`, şriftlər (self-host) | ✅ kopyalanır |
| Backend `Program.cs`, `appsettings.Production.json`, csproj, CI workflow, deploy nümunələri | ✅ statik oxunuş — tapıntılar §1 |
| `dotnet build -c Release --warnaserror`, `SecurityRegressionTests`, `dotnet list package --vulnerable` | ⏸ **bulud mühitində .NET SDK/NuGet yoxdur** → `deploy/predeploy-check.ps1` bunları lokalda bir əmrlə işlədir (Faza A) |

Frontend production-a hazırdır. Backend kodu audit + düzəlişlərdən keçib, amma **son build/test lokalda alınmalıdır** — skript hazırdır.

---

## 1. Bu sessiyada tapılan və düzəldilən problemlər

| # | Ciddilik | Tapıntı | Düzəliş |
|---|---|---|---|
| P0-1 | 🔴 | `appsettings.Production.json` → `AllowedHosts: "kiberaz.az;www.kiberaz.az"` — API `api.kiberaz.az`-da işləyir, HostFiltering **hər sorğuya 400 "Invalid Host"** qaytaracaqdı | `api.kiberaz.az` əlavə edildi; nginx-də `proxy_set_header Host $host` şərti sənədləşdi |
| P0-2 | 🔴 | `nginx-spa.conf.example`: `location /` və `/assets/` bloklarında öz `add_header` var → nginx qaydası ilə server səviyyəsindəki **bütün təhlükəsizlik başlıqları itirdi** (XFO, HSTS, frame-ancestors) | Başlıqlar snippet-ə çıxarıldı və hər location-da `include`; HTTP→HTTPS və `www`→apex 301 əlavə edildi |
| P1-1 | 🟠 | Data Protection açarları konfiqurasiya olunmayıb — systemd altında `HOME` yoxdursa açar efemerdir: **hər restart-da göndərilmiş təsdiq/şifrə-sıfırlama linkləri ölür**, Google girişi correlation cookie-si sınır | `DataProtection:KeysPath` (env `DataProtection__KeysPath`) — Production-da məcburi, `PersistKeysToFileSystem`; default `./App_Data/keys` |
| P1-2 | 🟠 | API üçün nginx nümunəsi, systemd unit, env şablonu, deploy/rollback/backup skripti **yox idi** | `deploy/nginx-api.conf.example`, `deploy/kiberaz-api.service`, `deploy/kiberaz-api.env.example`, `deploy/deploy.sh`, `deploy/backup.sh` |
| P1-3 | 🟠 | Monitorinq üçün endpoint yoxdur (hər endpoint auth tələb edir) | `GET /health` — anonim, bazaya toxunmur; `deploy.sh` onunla start-ı yoxlayır |
| P1-4 | 🟠 | CI-də `dotnet test Kiberaz.sln` **heç nə işlətmir** — `SecurityRegressionTests` sln-də deyil və konsol tətbiqidir | `predeploy-check.ps1` harness-i açıq çağırır; CI üçün 🔵 (§6) |
| P2-1 | 🟡 | `DEPLOY-CHECKLIST.md` "məhdudiyyətlər" cədvəli köhnə idi (leaderboard mock, upload anonim, tək refresh token — hamısı artıq düzəlib) | Cədvəl yeniləndi, sənəd bu roadmap-a yönləndirir |
| P2-2 | 🟡 | `wwwroot/uploads` publish qovluğunun içindədir — redeploy şəkilləri silər | `deploy.sh` `/var/kiberaz/uploads`-a symlink edir |
| P2-3 | 🟡 | Single-file/trimmed publish PDF worker-i sındırar (`Assembly.Location` boş olur) | systemd unit + skriptdə framework-dependent publish sabitləndi |

Dəyişən fayllar: `Kiberaz.Api/Program.cs` (DataProtection + `/health`), `Kiberaz.Api/appsettings.Production.json`,
`kiberaz-ui/deploy/nginx-spa.conf.example`, `DEPLOY-CHECKLIST.md`; yeni: `deploy/*`, `docs/PRODUCTION-ROADMAP.md`.
`Program.cs` dəyişikliyi buludda kompilyasiya edilməyib — Faza A-nın ilk addımı bunu təsdiqləyir.

---

## 2. Faza A — Lokal (bu gün, ~30 dəq)

```powershell
# repo kökündən
Copy-Item kiberaz-ui/env.production.example kiberaz-ui/.env.production   # dəyərlər artıq realdır
pwsh -File deploy/predeploy-check.ps1
```

Skript sıra ilə: `dotnet build --warnaserror` → NuGet zəiflik auditi → `SecurityRegressionTests` →
**Production fail-fast testi** (test CAPTCHA açarı ilə tətbiq qalxmamalıdır) → `dotnet publish` (Development/Local
appsettings silinir, `seed-data/` yoxlanır) → frontend `tsc + eslint + audit + build` → `dist/index.html` CSP yoxlanışı.

- [ ] 🔴 Skript "HAMISI YAŞIL" ilə bitir
- [ ] 🔴 `SecurityRegressionTests` çıxışında uğursuz assertion yoxdur (çoxcihazlı refresh, upload kvotası yeni testlərdir)
- [ ] 🟠 Dəyişiklikləri commit et (git əməliyyatlarını özün idarə edirsən)

---

## 3. Faza B — Server hazırlığı (1 gün)

**Server:** Ubuntu 24.04 LTS, ≥ 2 vCPU / 2 GB RAM / 40 GB SSD (PDF worker 512 MB-a qədər ala bilər), statik IP.

- [ ] 🔴 DNS: `A kiberaz.az`, `A www.kiberaz.az`, `A api.kiberaz.az` → server IP (Cloudflare işlədirsənsə **"DNS only"**, proxy YOX — əks halda `ForwardedHeaders__KnownProxies` doldurulmalıdır və rate-limit/IP audit dəyişir)
- [ ] 🔴 Paketlər:
  ```bash
  sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx aspnetcore-runtime-9.0 unzip
  dotnet --list-runtimes   # Microsoft.AspNetCore.App 9.0.x görünməli (son patch)
  ```
- [ ] 🔴 İstifadəçi və qovluqlar (`deploy/kiberaz-api.service` başlığındakı əmrlər): `/var/kiberaz/{app,data,keys,uploads,releases,incoming,backup}`, `/var/www/kiberaz`, `/etc/kiberaz/api.env` (640, root:kiberaz)
- [ ] 🔴 `/etc/kiberaz/api.env` — `deploy/kiberaz-api.env.example`-dən; hər `CHANGE_ME` real dəyərlə:
  - `JwtSettings__SecretKey` ← `openssl rand -base64 64`
  - `ConnectionStrings__LiteDb=Filename=/var/kiberaz/data/Kiberaz.db;Connection=shared`
  - `DataProtection__KeysPath=/var/kiberaz/keys`
  - `FrontendUrl=https://kiberaz.az`
  - `EmailSettings__SmtpUsername/__SmtpPassword` ← Gmail **App Password** (2FA aktiv olmalıdır)
  - `Captcha__SecretKey` ← Cloudflare Turnstile **Secret Key** (site key `0x4AAAAAADgQ4cetpZfAxN2U` frontenddədir)
- [ ] 🔴 Cloudflare Turnstile widget → hostname siyahısı: `kiberaz.az`, `www.kiberaz.az` (backend `Captcha:AllowedHostnames` bunlarla tutuşdurur)
- [ ] 🟠 Google Cloud Console → OAuth client → Authorized redirect URI: `https://api.kiberaz.az/signin-google`; `Authentication__Google__*` env-ə
- [ ] 🟠 Gmail göndərişi üçün DNS: SPF (`v=spf1 include:_spf.google.com ~all`) + DKIM (Google Workspace-dirsə) — yoxsa təsdiq e-poçtları spam-a düşür. `FromEmail=noreply@kiberaz.az` Gmail hesabı ilə göndərilirsə Gmail "via" göstərəcək — ya Workspace, ya da `FromEmail`-i real hesab et
- [ ] 🟠 nginx: `deploy/nginx-api.conf.example` → `api.kiberaz.az`; `kiberaz-ui/deploy/nginx-spa.conf.example` → `kiberaz.az` (snippet faylını da yarat); `sudo certbot --nginx -d kiberaz.az -d www.kiberaz.az -d api.kiberaz.az`; `nginx -t`
- [ ] 🟠 Firewall: `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable` — 5000 portu xaricə bağlı qalır
- [ ] 🟡 `unattended-upgrades` aktiv; SSH yalnız açarla

---

## 4. Faza C — İlk deploy (~1 saat)

```powershell
# Windows-dan
scp -r publish kiberaz-ui/dist user@SERVER:/var/kiberaz/incoming/
scp deploy/deploy.sh deploy/backup.sh user@SERVER:/var/kiberaz/deploy/
```
```bash
# serverdə
sudo systemctl daemon-reload && sudo systemctl enable kiberaz-api
sudo bash /var/kiberaz/deploy/deploy.sh          # backup → release → /health gözləyir → SPA → nginx reload
journalctl -u kiberaz-api -n 50 --no-pager       # gözlənilən: "✅ QuizSeeder: 8 kateqoriya", "250 sual"; CAPTCHA/JWT xətası YOX
```

- [ ] 🔴 `/health` → `{"status":"ok"}`; loglarda `Captcha`, `JWT`, `DataProtection` istisnası yoxdur
- [ ] 🔴 **Admin hesabı:** `kiberaz.az@gmail.com` ilə qeydiyyat → e-poçt təsdiqi → `sudo systemctl restart kiberaz-api` → `EnforceSingleAdministrator` hesabı Admin edir (loglarda "Sabit sistem administratoru… tapılmadı" qalmamalıdır). **Bunu ictimai elandan ƏVVƏL et.**
- [ ] 🔴 Təmiz baza ilə başla (Faza 3-A): development `Kiberaz.db` serverə getmir — test hesabları, köhnə refresh token sxemi orada var
- [ ] 🟠 `sudo crontab -e` → `0 3 * * * /var/kiberaz/deploy/backup.sh >> /var/log/kiberaz/backup.log 2>&1`

---

## 5. Faza D — Smoke test (deploy-dan dərhal sonra, sıra ilə)

Başlıqlar / infrastruktur
- [ ] `curl -I https://kiberaz.az` → `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Strict-Transport-Security` — **həm `/` həm `/assets/…` üçün** (P0-2 yoxlaması)
- [ ] `curl -I https://api.kiberaz.az/api/quiz/categories` → 200 + `X-Content-Type-Options`, `Content-Security-Policy: default-src 'none'…`; `http://` → 301
- [ ] `https://api.kiberaz.az/swagger` → 404 · `https://kiberaz.az/reset-password` → SPA açılır (404 yox)
- [ ] `curl -H "Host: evil.com" https://api.kiberaz.az/health` → 400 (HostFiltering işləyir)

Funksional
- [ ] Ana səhifə: hero, kateqoriyalar (8), liderlik lövhəsi real bazadan (boş ola bilər)
- [ ] Quiz aç → sual → cavab → izahat
- [ ] Qeydiyyat → e-poçt gəlir (spam qovluğu!) → link `#userId=…&token=…` → təsdiq → giriş → dashboard
- [ ] Səhifəni yenilə → sessiya qalır (refresh cookie `Secure; SameSite=Strict` — DevTools → Application → Cookies, `api.kiberaz.az`)
- [ ] İkinci brauzerdə giriş → birinci sessiya **qalır** (M1 düzəlişi); birində "Çıxış" → yalnız o cihaz çıxır
- [ ] Şifrəni unutdum → link → yeni şifrə → köhnə şifrə ilə giriş alınmır; **sonra `systemctl restart kiberaz-api` edib yeni "şifrəni unutdum" linkinin hələ işlədiyini yoxla** (P1-1)
- [ ] Yanlış şifrə ×6 → CAPTCHA çıxır → həll → giriş alınır (alınmırsa `Captcha__SecretKey`/hostname siyahısı səhvdir)
- [ ] Google ilə giriş (konfiqurasiya edilibsə) → `/google-login-callback` → dashboard
- [ ] VIP hesab (admin panelindən ver) → şəkil + PDF sillabus yüklə (≤ 10 MB) → təlim yarat → **Pending** → admin approve → ictimai siyahıda görünür; PDF-i anonim aç (`Content-Disposition: attachment`)
- [ ] 12 MB PDF → düzgün 413/400 mesajı (nginx `client_max_body_size 12m` + tətbiq limiti)
- [ ] Admin: dashboard rəqəmləri real; öz rolunu dəyişmək / özünü bloklamaq → rədd; başqasını blokla → onun açıq sessiyası dərhal 401
- [ ] Admin olmayan hesabla `GET /api/admin/users` → 403, cavabda e-poçt yoxdur

---

## 6. Faza E — İlk həftə (🟡)

- [ ] Uptime monitorinqi: `https://api.kiberaz.az/health` + `https://kiberaz.az` (UptimeRobot / Better Stack, 1–5 dəq; qlobal IP limiti 600/dəq-ə sığır)
- [ ] `journalctl -u kiberaz-api | grep SecurityEvents` — ilk günlərdə token rədd səbəbləri, kilidlər, refresh reuse hadisələri; anormal IP-lər üçün `ufw`/fail2ban
- [ ] Backup-ın işlədiyini yoxla: `/var/kiberaz/backup/kiberaz-*.tgz` gündəlik; **serverdən kənara** kopyalama (rclone → obyekt anbarı) + şifrələmə (`age`) — I1: DB şifrəsizdir
- [ ] Disk: `du -sh /var/kiberaz/uploads` və `Uploads__MaxTotalBytes/MinFreeBytes` real diskə görə
- [ ] Rate-limit müşahidəsi: 429-ların sayı (nginx access log) — sinif/ofis NAT-larda `general` 60/dəq darlıq edərsə artır
- [ ] Gmail göndəriş limiti (~500/gün adi hesab, 2000/gün Workspace) — qeydiyyat axını buna sığmalıdır; sığmasa SMTP relay (Brevo/Postmark)
- [ ] CI: `tools/SecurityRegressionTests`-i `.github/workflows/security.yml`-ə açıq addım kimi əlavə et (`dotnet run --project … --artifacts-path …`) — hazırda `dotnet test` heç bir test tapmır (P1-4)

---

## 7. Faza F — Launch-dan sonra (🔵, prioritet sırası ilə)

1. **Staging mühiti** (eyni serverdə ikinci systemd unit, `staging.kiberaz.az`) — production-a birbaşa deploy riskini azaldır; `!IsDevelopment()` sayəsində Staging da production qaydaları ilə işləyir
2. **Xəta izləmə** — `ExceptionMiddleware` TraceId ilə loglayır; Sentry/Seq kimi toplayıcı əlavə et ki, 500-lər görünsün
3. **L3 (Teacher/razılıq)** — dəvət kodu / tələbənin qəbulu modeli (audit qərarı ilə açıq qalıb)
4. **I3/I4** — liderlik lövhəsində alt-hesab öyrənməsi; `GET /api/course` müəllim e-poçt/telefon toplanması → e-poçtu yalnız daxil olmuş istifadəçiyə göstər
5. **LiteDB → PostgreSQL** həddi: eyni anda > ~200 aktiv istifadəçi və ya `Kiberaz.db` > 1 GB olanda, ya da ikinci instans lazım olanda (rate-limit yaddaşdadır, LiteDB tək prosesdir)
6. **Frontend chunk bölgüsü** — 466 KB tək bundle; Admin/ExamSession/QuizView `React.lazy` ilə ayrılsa ilk yükləmə ~40% azalar (perf, təhlükəsizlik deyil)
7. **HSTS preload** — 1 il + includeSubDomains stabil işlədikdən sonra (geri dönməzdir)
8. **Cloudflare proxy** istənilsə: `ForwardedHeaders__KnownProxies` Cloudflare IP siyahısı ilə, rate-limit açarı `CF-Connecting-IP`-ə keçirilməlidir — indi YOX

---

## 8. Rollback

- `sudo bash /var/kiberaz/deploy/deploy.sh rollback` — əvvəlki `api-*`/`dist-*` release-ə keçir (30 s)
- DB geri qaytarma: `systemctl stop kiberaz-api && tar -xzf /var/kiberaz/backup/pre-deploy-<stamp>.tgz -C /var/kiberaz && systemctl start kiberaz-api`
- Qərar meyarı: qeydiyyat **və ya** giriş işləmirsə → dərhal rollback, sonra araşdır
- Sxem qeydi: bu versiya köhnə `RefreshToken` sahələrini tanımır — rollback edilsə hər kəs bir dəfə yenidən daxil olur (tərsi də doğrudur)

---

## 9. Risk reyestri (açıq qalanlar)

| Risk | Təsir | Azaltma |
|---|---|---|
| Gmail SMTP kəsilməsi / limiti | Qeydiyyat dayanır (fallback yoxdur) | `EmailQueue` 3 cəhd; monitorinqdə "EmailDispatcher" xətaları; relay planı (Faza E) |
| Tək server, tək LiteDB faylı | Disk/fayl zədələnməsi = tam dayanma | Gündəlik + kənar backup; `Connection=shared`; restart 5 s |
| Turnstile kəsilməsi | Login/register 5 s timeout → rədd (fail-closed) | Cloudflare status; `Captcha` yalnız 5 uğursuz cəhddən sonra tələb olunur |
| `ASPNETCORE_ENVIRONMENT` səhv qalması | Swagger açıq, limitlər 1000/dəq, CAPTCHA bypass | systemd unit sabitləyir; `predeploy-check` fail-fast testi |
| PDF worker `dotnet` tapmır | Sillabus yükləməsi 500 | `ExecStart=/usr/bin/dotnet …` (worker `Environment.ProcessPath`-i işlədir); single-file publish qadağandır |
