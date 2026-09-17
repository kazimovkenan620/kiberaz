# Kiberaz.az: ilk serverdən canlı sayta qədər

Tarix: **17 sentyabr 2026**. Bu sənəd icra təlimatıdır; serverin alındığını, DNS-in dəyişdiyini və ya production testlərinin keçdiyini bildirmir. Lokal yoxlamanın nəticəsi ayrıca QA hesabatından götürülməlidir. Server və domenə giriş olmadan aşağıdakı uzaq mühit addımları yoxlanmış sayılmır.

**Tövsiyə:** Almaniya və ya Finlandiyada **Hetzner CX33, x86_64, 4 vCPU / 8 GB RAM / 80 GB NVMe, Ubuntu 24.04 LTS**, açıq IPv4, provayder backup-u və şifrəli xarici backup. Bu, resurs ehtiyatı olan başlanğıc ölçüsüdür; eyni vaxtda neçə istifadəçiyə xidmət edəcəyinə dair zəmanət deyil. Sifarişdə mövcudluğu və yekun qiyməti yoxla. Sərt 10 € həddi varsa CX23 seçimi aşağıdadır.

**Bu günün ardıcıllığı:** domen və poçt hesabları → lokal test/publish → server və SSH → sistem paketləri → DNS/TLS → sirlər/systemd → ilk deploy → sahib hesabı və funksional test → xarici backup və bərpa sınağı → ictimai açılış. Domen, provayder təsdiqi və SMTP aktivləşməsi eyni gün bitməyə bilər.

Əmrləri **sətir-sətir** icra et və hər yoxlamanın nəticəsini oxu; xəta çıxanda növbəti sətirə keçmə. Böyük blokun bütövlükdə terminala yapışdırılması bəzi uğursuz əmrlərdən sonra növbəti addımı yenə işlədə bilər. `SERVERIN_REAL_IPV4_UNVANI`, `ARXIV.tgz`, `BUCKET_ADI` və buraxılış ID-si kimi yer tutucular real dəyərlə əvəzlənir.

## 1. Nəyi yerləşdiririk və xərci nədir?

| Termin | Bu layihədə mənası |
|---|---|
| VPS | İnternetdə gecə-gündüz açıq qalan kirayə Linux kompüteri. Yeniləmə və backup sənin məsuliyyətindir. |
| Domen / DNS | `kiberaz.az` adı və bu adı serverin IP-sinə bağlayan qeydlər. Server almaq domen almaq deyil. |
| Nginx | Brauzerə React fayllarını verir, API sorğularını daxildə .NET prosesinə ötürür. |
| TLS / HTTPS | Brauzer–server əlaqəsini şifrələyən sertifikat. |
| systemd | API-ni server açıldıqda başladan və dayandıqda yenidən işə salan xidmət idarəçisi. |
| Release / rollback | Birlikdə test edilmiş API+UI buraxılışı / əvvəlki buraxılışa qayıdış. |
| Backup / restore | Məlumatın ayrıca nüsxəsi / həmin nüsxədən işlək sistemin bərpası. |

```text
Brauzer ── HTTPS:443 ── Nginx
                        ├── kiberaz.az → /var/www/kiberaz/dist (React)
                        └── api.kiberaz.az → 127.0.0.1:5000 (bir .NET API)
                                                  ├── data/Kiberaz.db
                                                  ├── uploads/
                                                  └── keys/
```

LiteDB server xidməti deyil: lokal diskdə fayldır. **Bir API instansı** saxla. İkinci replika, autoscaling, eyni DB-ni şəbəkə diski ilə paylaşmaq və efemer disk bu planın hissəsi deyil. `Connection=shared` tətbiqin prosesdaxili kilidlərini bir neçə API arasında təhlükəsiz etmir. React-i Nginx verdiyi üçün serverdə Node/Vite development serveri işləməyəcək.

### 17.09.2026 tarixli qiymət müqayisəsi

| Seçim | Resurs | Aylıq baza qiyməti | IPv4 və backup | Qərar |
|---|---|---|---|---|
| Hetzner CX23 | 2 vCPU, 4 GB, 40 GB NVMe | **5,49 €**, ƏDV xaric | IPv4 **0,50 €**, backup **20% ≈ 1,10 €**; cəmi **7,09 €** ƏDV xaric | Ən ucuz başlanğıc; diskdə lokal arxivlərə daha diqqətli nəzarət et. |
| **Hetzner CX33** | 4 vCPU, 8 GB, 80 GB NVMe | **8,49 €**, ƏDV xaric | IPv4 **0,50 €**, backup **≈ 1,70 €**; cəmi **10,69 €** ƏDV xaric | Tövsiyə; PDF worker və sistem üçün daha çox yaddaş/disk ehtiyatı. |
| netcup VPS 500 G12 | 2 x86 vCore, 4 GB, 128 GB NVMe | **5,91 €**, göstərilən 19% ƏDV daxil; **12 aylıq müqavilə və ödəniş dövrü** | IPv4+IPv6 daxildir. Müddətsiz seçim **+0,90 €**, konkret Aİ lokasiyası **+0,90 €**. Snapshot xarici tətbiq backup-unu əvəz etmir. | Daha çox disk; müqavilə və mövcudluq şərtlərini diqqətlə seç. |

Hetzner qiymətləri 15 iyun 2026-dan yeni sifarişlər üçündür; köhnə bloq qiymətlərinə əsaslanma. Mənbələr: [cari Hetzner qiymət cədvəli](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [resurslar](https://www.hetzner.com/cloud/cost-optimized/), [IPv4](https://docs.hetzner.com/cloud/servers/primary-ips/overview/), [backup hesablanması və 7 nüsxə](https://docs.hetzner.com/cloud/billing/faq/), [netcup konfiquratoru](https://www.netcup.com/en/server/vps/vps-500-g12-iv-12m). Səhifələrdə bəzi lokasiyalar üçün çatışmazlıq/gecikmə göstərilir; **bu gün aktivləşmə zəmanəti yoxdur**.

Hetzner-də 25/465 çıxış portları ilkin olaraq bağlıdır, **587 açıqdır**. netcup-da standart **Mail Block** firewall siyasəti SMTP-ni bloklayır; provayder panelində bu siyasəti uyğunlaşdırmaq və 587 çıxışını yoxlamaq lazımdır. Öz mail serverini qurma; autentifikasiyalı SMTP provayderindən istifadə et. [Hetzner SMTP qaydası](https://docs.hetzner.com/cloud/servers/faq/#why-can-i-not-send-any-mails-from-my-server), [netcup firewall](https://www.netcup.com/en/helpcenter/documentation/server/firewall).

**Aylıq büdcə:** CX33+IPv4+provayder backup-u 10,69 € net; yalnız nümunə üçün 19% ƏDV ilə **12,72 €** edir. Xarici backup üçün **2 € ehtiyat büdcəsi** ayır: bu tarif deyil, istifadəyə bağlı xərc üçün plan rəqəmidir. Backblaze B2-də cari saxlama qiyməti **6,95 USD/TB/30 gün**, ilk **10 GB pulsuzdur**; məsələn cəmi 100 GB saxlama təxminən 0,63 USD/ay saxlama haqqıdır, əlavə əməliyyat/çıxış və vergi ayrıca ola bilər. [B2 qiymətləri](https://www.backblaze.com/cloud-storage/pricing).

Beləliklə CX33 üçün server+backup büdcəsi təxminən **15 €/ay** səviyyəsində planlana bilər. Ödəniş ölkəsi, bankın məzənnəsi və vergisi kassadakı məbləği dəyişir. **Domenin illik yenilənməsi** və SMTP pulsuz limiti aşılarsa ödənişli plan bu hesabdan ayrıdır. Mövcud domenin sahibi və yenilənmə qiyməti hələ təsdiqlənməyibsə, tam illik büdcə hazır deyil. Serveri sadəcə söndürmək Hetzner ödənişini dayandırmır; istifadə edilməyən server/IP/snapshot resursları ayrıca ləğv olunur.

## 2. Server almadan görülən işlər

### 2.1. Domen və hesablar

Bu təlimat hazır repo ilə uyğun **kiberaz.az**, **www.kiberaz.az**, **api.kiberaz.az** adlarını istifadə edir. Domen sənin nəzarətində deyilsə DNS/TLS mərhələsinə keçmə. Başqa domen seçilirsə frontend URL/CSP, `AllowedHosts`, CORS, Turnstile hostname-ləri, Nginx, Google callback və poçt göndəricisi birlikdə yenilənməlidir; sadəcə DNS adını dəyişmək kifayət etmir.

Hazırla:

- Domen registratoru/DNS panelinə giriş və yenilənmə tarixi.
- VPS hesabı üçün iki mərhələli giriş, hesab bərpa kodlarının parol menecerində nüsxəsi.
- **Sahib poçtuna giriş:** kodda administrator ünvanı `Kiberaz.Domain/Common/SystemAccounts.cs` daxilində sabitdir. Hazırda `kiberaz.az@gmail.com`-dur; bu ünvanın sahibi olmalısan.
- SMTP hesabı və təsdiqlənmiş göndərici; Turnstile widget-i; ayrıca backup hesabı.
- Sirləri chat-a, Git-ə, screenshot-a və frontend `.env` faylına yazma. Frontend-də yalnız ictimai site key və API URL olur.

### 2.2. Runtime qərarı

Repo **.NET 9** istifadə edir. 17.09.2026 tarixində Microsoft-un aktual patch-i **9.0.20**, dəstəyin sonu **10 noyabr 2026**-dır. Bu bələdçi framework-ü dəyişmir. Cari 9.0.x təhlükəsizlik yeniləmələrini quraşdır, **noyabrdan əvvəl .NET 10 LTS keçidini ayrıca planlaşdır və test et**. .NET 8-ə enmək dəstək müddətini uzatmır. [Rəsmi .NET dəstək siyasəti](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).

### 2.3. Lokal Windows: test və təmiz buraxılış

PowerShell-i **öz Windows kompüterində**, repo kökündə aç:

```powershell
Set-Location C:\Users\User\Desktop\kiberaz
git status --short
pwsh --version
dotnet --list-sdks
node --version
npm --version
```

PowerShell **7** (`pwsh`), `.NET 9` target-ını build edə bilən **SDK 9 və ya daha yeni SDK**, həmçinin layihə alətləri ilə uyğun Node quraşdırılmış olmalıdır. SDK versiyası ilə tətbiqin runtime versiyası fərqlənə bilər: məsələn, SDK 10 bu layihəni `.NET 9` üçün build edə bilər, serverdə yenə ASP.NET Core 9 runtime lazımdır. Mövcud dəyişiklikləri saxla. `git reset --hard`, `git clean` və lokal bazanı silmək bu prosesin hissəsi deyil.

Yalnız `.env.production` yoxdursa şablonu köçür:

```powershell
if (-not (Test-Path kiberaz-ui/.env.production)) {
    Copy-Item kiberaz-ui/env.production.example kiberaz-ui/.env.production
}
notepad kiberaz-ui/.env.production
```

Faylda `VITE_API_URL=https://api.kiberaz.az/api` və **öz widget-inin real ictimai** `VITE_TURNSTILE_SITE_KEY` dəyəri olmalıdır. Secret key burada olmamalıdır. Reponun nümunəsində görünən site key-in sənin hesabına aid olduğunu fərz etmə. Sonra:

```powershell
pwsh -File deploy/predeploy-check.ps1
git diff --check
git status --short
```

**Keçid şərti:** backend Release build, təhlükəsizlik reqressiya testləri, səhv Production CAPTCHA-nın startda rəddi, frontend TypeScript/lint/audit/build və publish yoxlamaları uğurludur. Yekun yoxlama qaçırılıbsa və ya xəta varsa serverə yük göndərmə. İctimai provayderə aid SMTP/CAPTCHA/DNS testləri bu lokal nəticədən çıxarılmır.

Skript hər run üçün ayrıca `artifacts/releases/<buraxılış-id>/` qovluğu yaradır; əvvəlki lokal build-i silmir. Uğurlu run-un sonunda göstərilən **dəqiq qovluğu** qeyd et: içində `publish/`, `dist/`, `manifest.json` və `release-config-check.json` olur. Əvvəlki `publish/` və `kiberaz-ui/dist/` qovluqlarını bu paketlə qarışdırma. `publish/seed-data/` daxilində **həm kateqoriya, həm sual JSON-u** var; bunlar cavab açarları saxlayır və yalnız API-nin qeyri-ictimai qovluğuna gedir. Lokal `Kiberaz.db`, istifadəçi uploads-u, `.env`, development/local settings və açarlar paketə getməməlidir. Seed faylları gitignored olduğuna görə təmiz Git checkout-da avtomatik olacaqlarını fərz etmə.

`-FrontendEnvPath` parametri ilə nümunə public env əsasında lokal namizəd paket də yoxlanıla bilər. **Bu, real widget sahibliyini və hostname uyğunluğunu təsdiqləmir.** Serverə gedən final paket üçün öz panelindən alınmış dəyərlərlə `.env.production` istifadə et və yenidən gate işlə.

Publish **framework-dependent**, single-file və trimming söndürülmüş olmalıdır: PDF sanitizer eyni DLL-dən ayrıca worker prosesi açır. Bütün repo əvəzinə yalnız yoxlanmış build çıxışlarını köçür. Buraxılışın commit/diff vəziyyətini və yoxlama tarixini qeyd et.

## 3. VPS seçimi və ilk SSH girişi

Provayder panelində Ubuntu **24.04 LTS x86_64/amd64**, EU lokasiyası, açıq IPv4 və backup seç. ARM/CAX bu təlimatın yoxlanacaq hədəfi deyil. SSH açarının **public** hissəsini server yaratma ekranına əlavə et; private açarı yükləmə.

**Windows PowerShell** — ayrıca açar yarat, mövcud faylı əvəz etmə:

```powershell
ssh-keygen -t ed25519 -a 64 -f "$env:USERPROFILE/.ssh/kiberaz_server" -C "kiberaz-server"
Get-Content "$env:USERPROFILE/.ssh/kiberaz_server.pub"
$ServerIp = 'SERVERIN_REAL_IPV4_UNVANI'
ssh -i "$env:USERPROFILE/.ssh/kiberaz_server" "root@$ServerIp"
```

`ssh-keygen` zamanı güclü passphrase ver. İlk qoşulmadakı server fingerprint-ini provayder konsolundakı ilə yoxla. Provayder ilkin istifadəçi kimi `ubuntu` verirsə `root` əvəzinə onu istifadə et və aşağıdakıları `sudo` ilə icra et.

**Server Linux shell** — gündəlik idarəetmə istifadəçisi:

```bash
adduser deployer
usermod -aG sudo deployer
install -d -m 700 -o deployer -g deployer /home/deployer/.ssh
install -m 600 -o deployer -g deployer /root/.ssh/authorized_keys /home/deployer/.ssh/authorized_keys
```

Bu `authorized_keys` yolu yalnız root-a public key ilə daxil olduqda uyğundur; `ubuntu` hesabından başlamısansa public açarı həmin hesabın `.ssh/authorized_keys` faylından köçür. İlk sessiyanı açıq saxla, **ikinci Windows terminalında** `deployer` ilə giriş və `sudo -v` uğurunu yoxla. Bundan əvvəl root/parol girişini bağlama.

Serverdə `sudoedit /etc/ssh/sshd_config.d/00-kiberaz.conf` ilə bunları yaz:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

```bash
sudo sshd -t
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication'
sudo systemctl reload ssh
```

Yenidən ayrıca sessiyada açarla girişi yoxla. Xəta olarsa açıq sessiyadan ayarı düzəlt; provayderin konsolu ehtiyat giriş yoludur.

## 4. Server paketləri, firewall və daimi qovluqlar

**Bundan sonrakı bash əmrləri SSH ilə serverdədir.** Lokal PowerShell-də işlətmə.

```bash
sudo apt update
sudo apt upgrade
sudo apt install nginx certbot python3-certbot-nginx ufw curl openssl software-properties-common rclone
sudo add-apt-repository ppa:dotnet/backports
sudo apt update
sudo apt install aspnetcore-runtime-9.0
dotnet --list-runtimes
nginx -v
```

`Microsoft.AspNetCore.App 9.0.x` və `Microsoft.NETCore.App 9.0.x` görünməlidir; patch cari olmalıdır. Ubuntu 24.04-də .NET 9 üçün Canonical backports istifadə edilir; .NET paketlərini Microsoft və Ubuntu mənbələri arasında qarışdırma. Serverdə SDK lazım deyil. [Microsoft Ubuntu quraşdırma təlimatı](https://learn.microsoft.com/en-us/dotnet/core/install/linux-ubuntu-decision).

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Əvvəl SSH qaydasını əlavə et, sonra firewall-u aktivləşdir. Provayder firewall-u varsa eyni inbound portları aç. Sabit idarəetmə IP-si olduqda 22-ni həmin IP-yə məhdudlaşdır. **5000/5251/5173 portlarını və DB fayllarını internetə açma.** 80 TLS sertifikatının verilməsi/yenilənməsi və HTTPS yönləndirməsi üçün qalır. [Let’s Encrypt port 80 qaydası](https://letsencrypt.org/docs/allow-port-80/).

```bash
sudo useradd --system --home /var/kiberaz --shell /usr/sbin/nologin kiberaz
sudo install -d -o root -g root -m 755 /var/kiberaz /var/kiberaz/releases /var/kiberaz/deploy /var/www/kiberaz
sudo install -d -o kiberaz -g kiberaz -m 750 /var/kiberaz/data /var/kiberaz/keys /var/kiberaz/runtime
sudo install -d -o kiberaz -g kiberaz -m 750 /var/kiberaz/uploads /var/kiberaz/uploads/photos /var/kiberaz/uploads/syllabus
sudo install -d -o root -g root -m 700 /var/kiberaz/backup
sudo install -d -o root -g root -m 750 /var/log/kiberaz
sudo install -d -o root -g root -m 700 /etc/kiberaz
sudo install -d -o deployer -g deployer -m 750 /var/kiberaz/incoming
```

İstifadəçi/qovluqlar artıq varsa əvvəl sahibliyini yoxla; bu addım ilk server üçündür. **`/var/kiberaz/app` və `/var/www/kiberaz/dist` qovluqlarını yaratma.** Deploy skripti onları aktiv release-ə yönələn symlink edəcək. Tətbiq yalnız `data`, `keys`, `uploads`, `runtime` daxilində yazmalıdır; deploy skriptləri və releases API tərəfindən dəyişdirilməməlidir.

## 5. DNS və TLS: ilk sertifikatın düzgün ardıcıllığı

DNS panelində, real server IPv4-ü ilə:

| Tip | Ad | Dəyər |
|---|---|---|
| A | `@` | server IPv4 |
| A | `www` | həmin IPv4 |
| A | `api` | həmin IPv4 |

İlkin TTL 300 saniyə seçilə bilər. IPv6 marşrutlaması/firewall-u hazır deyilsə AAAA əlavə etmə; başqa serverə yönələn köhnə AAAA sertifikat yoxlamasını poza bilər. Mövcud MX/TXT poçt qeydlərini silmə. Cloudflare DNS istifadə edirsənsə ilk yerləşdirmədə **DNS only** saxla; Turnstile üçün narıncı proxy vacib deyil. Cloudflare proxy-ni sonradan aktivləşdirmək ayrıca real-IP/trust-chain işi tələb edir.

**Windows yoxlaması:**

```powershell
Resolve-DnsName kiberaz.az
Resolve-DnsName www.kiberaz.az
Resolve-DnsName api.kiberaz.az
```

Üç ad da düzgün serverə yönəlməlidir. İndi **serverdə** sertifikatsız, yalnız HTTP bootstrap qur:

```bash
sudo install -d -m 755 /var/www/letsencrypt/.well-known/acme-challenge
sudo tee /etc/nginx/sites-available/kiberaz-bootstrap >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kiberaz.az www.kiberaz.az api.kiberaz.az;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 503; }
}
EOF
sudo ln -s /etc/nginx/sites-available/kiberaz-bootstrap /etc/nginx/sites-enabled/kiberaz-bootstrap
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/letsencrypt --cert-name kiberaz.az -d kiberaz.az -d www.kiberaz.az
sudo certbot certonly --webroot -w /var/www/letsencrypt --cert-name api.kiberaz.az -d api.kiberaz.az
sudo certbot certificates
```

Certbot e-poçt və istifadə şərtlərini soruşacaq. HTTP-01 yoxlaması üçün port 80 internetdən əlçatan olmalıdır. **Sertifikat alınmadan 443 ssl şablonlarını aktivləşdirmə:** olmayan `fullchain.pem` Nginx yoxlamasını dayandırar. [Let’s Encrypt yoxlamaları](https://letsencrypt.org/docs/challenge-types/).

## 6. SMTP, Turnstile və server sirləri

### SMTP

Başlanğıcda Brevo Free istifadə edilə bilər: cari limit gündə **300 e-poçt**dur; hesabın göndəriş üçün aktivləşməsi və domen təsdiqi ayrıca şərtdir. Paneldə domeni təsdiqlə, göstərilən DKIM/DMARC və digər tələb olunan DNS qeydlərini əlavə et; mövcud SPF-ni ikinci SPF qeydi yaratmaqla pozma. Təsdiqlənmiş `noreply@kiberaz.az` göndəricisi yarat. SMTP açarı API açarından ayrıdır. [Pulsuz plan limiti](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), [SMTP ayarları](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

| Server ayarı | Dəyər |
|---|---|
| `EmailSettings__SmtpHost` | `smtp-relay.brevo.com` |
| `EmailSettings__SmtpPort` | `587` |
| `EmailSettings__SmtpUsername` | Brevo panelinin verdiyi SMTP login |
| `EmailSettings__SmtpPassword` | ayrıca yaradılmış SMTP key |
| `EmailSettings__FromEmail` | provayderdə təsdiqlənmiş göndərici |
| `EmailSettings__FromName` | `Kiberaz.az` |

Gmail alternativində `smtp.gmail.com:587`, hesabın login-i və **App Password** lazımdır. `FromEmail` yalnız həmin hesab və ya icazəli alias olmalıdır; şəxsi Gmail parolu və təsdiqsiz `noreply@...` istifadə etmə. App Password üçün iki mərhələli giriş və hesab siyasətinin icazəsi tələb olunur. [Google qaydası](https://support.google.com/accounts/answer/185833?hl=en).

SMTP provayderini seçdikdən sonra serverdən yalnız TLS bağlantısını yoxla; bu əmr məktub göndərmir:

```bash
timeout 15 openssl s_client -starttls smtp -connect smtp-relay.brevo.com:587 -servername smtp-relay.brevo.com -verify_return_error </dev/null
```

TLS uğuru login və çatdırılmanı təsdiqləmir. Funksional sınaqda öz poçtuna bir təsdiq məktubu çatmalıdır. Repo SMTP-ni fonda növbədən göndərir: API-nin uğurlu cavabı məktubun inbox-a çatması demək deyil.

### Turnstile və optional Google giriş

Cloudflare panelində widget yarat, yalnız `kiberaz.az` və `www.kiberaz.az` hostlarını əlavə et. **Site key** frontend build-ə, **secret key** yalnız serverə gedir. Production-da test açarı, localhost hostname-i və `AllowDevelopmentBypass=true` olmaz. [Turnstile başlanğıc](https://developers.cloudflare.com/turnstile/get-started/), [hostname qaydası](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

Google girişi ilk buraxılış üçün məcburi deyil. İstifadə ediləcəksə Google Cloud-da Web application OAuth client yarat, consent screen/audience-ni hazırla və redirect URI-ni **dəqiq** `https://api.kiberaz.az/signin-google` et. `ClientId` və `ClientSecret` server env-dədir. Testing rejimində yalnız icazəli test hesablarını gözlə. [Google redirect URI tələbi](https://developers.google.com/identity/protocols/oauth2/web-server).

### Env faylını serverdə doldur

Lokal deploy fayllarını köçürmək üçün **Windows**:

```powershell
ssh -i "$env:USERPROFILE/.ssh/kiberaz_server" "deployer@$ServerIp" "mkdir -p ~/kiberaz-stage"
scp -i "$env:USERPROFILE/.ssh/kiberaz_server" -r deploy "deployer@${ServerIp}:kiberaz-stage/"
scp -i "$env:USERPROFILE/.ssh/kiberaz_server" kiberaz-ui/deploy/nginx-spa.conf.example "deployer@${ServerIp}:kiberaz-stage/"
```

**Server:**

```bash
if sudo test ! -e /etc/kiberaz/api.env; then
  sudo install -o root -g root -m 600 ~/kiberaz-stage/deploy/kiberaz-api.env.example /etc/kiberaz/api.env
fi
sudoedit /etc/kiberaz/api.env
```

Mövcud production env varsa şablonla üstünə yazma; `sudoedit` ilə yalnız nəzərdə tutulan dəyərləri dəyiş. `api.env` shell skripti deyil, **systemd EnvironmentFile**-dır; `source` etmə. JWT üçün parol menecerində kriptoqrafik təsadüfi ən az 64 bayt yaradılmış dəyər saxla; real açarı əmr sətrinə/log-a yazma. Env faylında bunlar olmalıdır:

| Açar | Dəyər/məqsəd |
|---|---|
| `JwtSettings__SecretKey` | ayrıca güclü təsadüfi sirr; nümunə placeholder silinir |
| `ConnectionStrings__LiteDb` | `Filename=/var/kiberaz/data/Kiberaz.db;Connection=shared` |
| `DataProtection__KeysPath` | `/var/kiberaz/keys` |
| `FrontendUrl` | `https://kiberaz.az` |
| `Captcha__SecretKey` | öz real Turnstile secret-i |
| `EmailSettings__...` | yuxarıdakı bütün SMTP/göndərici ayarları, port **587** |
| `Authentication__Google__...` | yalnız istifadə edilirsə; əks halda boş |
| `Uploads__MaxTotalBytes`, `MaxFiles`, `MinFreeBytes` | nümunədə 2 GiB / 4000 / 2 GiB; disk və backup tutumuna uyğun |

Nginx eyni maşındadır: `ForwardedHeaders__KnownProxies` boş qalır. JWT sirrini hər deploy-da dəyişmə. DataProtection açarlarını silmək göndərilmiş təsdiq/şifrə sıfırlama linklərini etibarsız edə bilər.

## 7. systemd və son Nginx konfiqurasiyası

```bash
sudo install -o root -g root -m 755 ~/kiberaz-stage/deploy/common.sh /var/kiberaz/deploy/common.sh
sudo install -o root -g root -m 755 ~/kiberaz-stage/deploy/deploy.sh /var/kiberaz/deploy/deploy.sh
sudo install -o root -g root -m 755 ~/kiberaz-stage/deploy/backup.sh /var/kiberaz/deploy/backup.sh
sudo install -o root -g root -m 644 ~/kiberaz-stage/deploy/kiberaz-api.service /etc/systemd/system/kiberaz-api.service
sudo systemctl daemon-reload
sudo systemctl enable kiberaz-api
sudo systemd-analyze verify /etc/systemd/system/kiberaz-api.service
```

Burada **`--now` yoxdur**: ilk deploy-a qədər `/var/kiberaz/app` yaranmayıb. Windows-dan köçən `.sh` fayllarında `bash -n` yoxlaması apar; CRLF xətası çıxarsa LF ilə saxlanmış repo fayllarını yenidən göndər.

```bash
sudo bash -n /var/kiberaz/deploy/common.sh
sudo bash -n /var/kiberaz/deploy/deploy.sh
sudo bash -n /var/kiberaz/deploy/backup.sh
sudo install -d -m 755 /etc/nginx/snippets
sudo tee /etc/nginx/snippets/kiberaz-security-headers.conf >/dev/null <<'EOF'
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
EOF
sudo install -m 644 ~/kiberaz-stage/deploy/nginx-api.conf.example /etc/nginx/sites-available/api.kiberaz.az
sudo install -m 644 ~/kiberaz-stage/nginx-spa.conf.example /etc/nginx/sites-available/kiberaz.az
sudo ln -s /etc/nginx/sites-available/api.kiberaz.az /etc/nginx/sites-enabled/api.kiberaz.az
sudo ln -s /etc/nginx/sites-available/kiberaz.az /etc/nginx/sites-enabled/kiberaz.az
sudo unlink /etc/nginx/sites-enabled/kiberaz-bootstrap
sudo nginx -t
sudo systemctl reload nginx
```

Bu addım ilk aktivləşdirmə üçündür; mövcud symlink-i kor-koranə əvəz etmə. `nginx -t` uğursuzdursa reload etmə; config-i düzəlt və ya bootstrap-a qayıt. Ubuntu 24.04 paketindəki Nginx üçün şablon `listen 443 ssl http2;` formasını istifadə edir. Son HTTP konfiqlərində `/.well-known/acme-challenge/` saxlanmalıdır ki, webroot sertifikatı yenilənsin.

```bash
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
/usr/sbin/nginx -t && /bin/systemctl reload nginx
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
sudo systemctl list-timers certbot.timer
```

`dry-run` uğuru avtomatik yenilənmənin sınağıdır. HTTPS başlıqları üçün verilən `includeSubDomains` bütün istifadə edilən alt-domenlərin HTTPS hazır olmasını tələb edir. Hələlik API başlamadığı üçün 502/SPA 404 görmək mümkündür; bu mərhələdə deploy tamamlanmış sayılmır.

## 8. İlk deploy və əsas yoxlamalar

Deploy skripti `incoming` qovluğunu saxlayır. **Hər transferdən əvvəl serverdə**, həmin anda başqa deploy/transfer işləmədiyini yoxlayaraq köhnə staging-i ayır və boş giriş qovluğu hazırla:

```bash
sudo mv -T /var/kiberaz/incoming "/var/kiberaz/incoming-saved-$(date -u +%Y%m%d-%H%M%S)"
sudo install -d -o deployer -g deployer -m 750 /var/kiberaz/incoming
```

Bu yol yalnız build transferidir; `app`, `data`, `uploads`, `keys` burada daşınmır. İlk transferdə əvvəl yaradılmış boş `incoming` ayrılır. Qorunmuş staging-lər uğurlu deploy və backup təsdiqindən sonra ayrıca təmizlənir.

**Windows:** testdən çıxmış iki qovluğu göndər:

```powershell
$ReleasePath = 'C:\Users\User\Desktop\kiberaz\artifacts\releases\UGURLU_RUN_UN_DEQIQ_ID_SI'
scp -i "$env:USERPROFILE/.ssh/kiberaz_server" -r "$ReleasePath/publish" "$ReleasePath/dist" "deployer@${ServerIp}:/var/kiberaz/incoming/"
```

Yarımçıq əvvəlki transfer varsa onun üzərinə qarışıq build yığma; serverdə `incoming` məzmununu yoxla və yalnız bu staging qovluğundakı köhnə transferi ayrıca ayır. **Server:**

```bash
test -f /var/kiberaz/incoming/publish/Kiberaz.Api.dll
test -f /var/kiberaz/incoming/dist/index.html
sudo bash /var/kiberaz/deploy/deploy.sh
sudo systemctl status kiberaz-api --no-pager
sudo journalctl -u kiberaz-api -n 80 --no-pager
readlink -f /var/kiberaz/app
readlink -f /var/www/kiberaz/dist
sudo ss -ltnp
```

API və UI symlink-ləri eyni buraxılış ID-sini göstərməli, `5000` yalnız `127.0.0.1` üzərində dinləməlidir. Health yoxlaması **200 və `{"status":"ok"}`** tələb edir; sadəcə 301/307 cavabı uğur sayılmır:

```bash
curl --fail --show-error --silent -D - -H 'Host: api.kiberaz.az' -H 'X-Forwarded-Proto: https' http://127.0.0.1:5000/health
curl --fail --show-error --silent -D - https://api.kiberaz.az/health
curl --fail --show-error --silent -D - https://kiberaz.az/ -o /dev/null
curl --fail --show-error --silent https://api.kiberaz.az/api/Quiz/categories
```

`/health` prosesi yoxlayır, SMTP/backup və bütün DB axınlarını yoxlamır. Kateqoriya cavabı DB oxunuşunun əlavə yoxlamasıdır. İlk deploy uğursuzdursa əvvəlki release yoxdur; log/config-i düzəlt və yenidən deploy et. Sağlam baza olmadan ictimai elan vermə.

### Sahib administratorun ilk yaradılması

Boş bazada startup rolları və quiz seed-i yaradır, **hazır admin və parol yaratmır**. Sabit sahib ünvanı ilə normal UI qeydiyyatı et, həmin poçta gələn linki təsdiqlə. Sonra:

```bash
sudo systemctl restart kiberaz-api
```

Startup `EnforceSingleAdministrator` təsdiqli sahibə Admin rolunu tətbiq edir və köhnə sessiyanı ləğv edə bilər; yenidən daxil ol. Başqa e-poçta paneldən Admin vermək, DB-ni əllə dəyişmək və ya gizli hesabı siyahılara çıxarmaq olmaz. Sabit poçta giriş yoxdursa **admin hazırlığı bloklanır**; bunu əlavə config açarı həll etmir.

### İctimai açılışdan əvvəl brauzer sınağı

- HTTPS və `www → kiberaz.az` yönləndirməsi işləyir; Console-da CORS/CSP xətası yoxdur.
- Normal istifadəçi qeydiyyatı → real məktub → təsdiq → giriş → səhifə yeniləməsi → çıxış işləyir.
- Öz test hesabında şifrə sıfırlama, təkrar istifadə edilən/vaxtı keçən linkin davranışı yoxlanır.
- Turnstile real domendə görünür və server yoxlaması uğurludur; test açarı/bypass istifadə olunmur.
- Quiz kateqoriyası açılır, sual görünür, cavab göndərişi və nəticə işləyir; sual cavab açarları ictimai response-da yoxdur.
- Müəllim və adi istifadəçi icazələri, admin girişi yoxlanır; sahib hesabı siyahı/reytinqlərdə görünmür.
- Kiçik etibarlı şəkil/PDF yüklənir və açılır; zərərli/uyğunsuz fayl rədd edilir; PDF birbaşa Nginx static yoldan xidmət edilmir.
- API restart-dan sonra hesab, quiz nəticəsi, uploads və etibarlı linklər qalır.
- Google aktivdirsə real callback gediş-gəlişi işləyir; aktiv deyilsə bu sınaq tətbiq edilmir.

Məktub sınaqları yalnız sənin nəzarət etdiyin poçtlara edilir. Yük/abuse sınağını ictimai sistemdə plansız işlətmə; real istifadəçi sayı limiti ölçmə olmadan elan edilmir.

## 9. Backup: eyni serverdəki arxiv kifayət etmir

Bu üçü **eyni dayanma pəncərəsində** kopyalanmalıdır: `data/` (DB və əlaqəli fayllar), `uploads/`, `keys/`. Ayrı-ayrı tarixlərdən qarışdırma. Canlı LiteDB faylını adi `cp` ilə götürmə. Provayder snapshot-u əlavə qatdır; tətbiqin düzgün dayandırılmış arxivi və bərpa sınağı yenə lazımdır.

```bash
sudo bash /var/kiberaz/deploy/backup.sh
sudo systemctl is-active kiberaz-api
sudo ls -lh /var/kiberaz/backup
```

Skriptin göstərdiyi **dəqiq arxiv adını** qeyd et; aşağıda `ARXIV.tgz` onu bildirir. Tarın uğuru hələ işlək bərpa demək deyil:

```bash
sudo tar -tzf /var/kiberaz/backup/ARXIV.tgz
sudo sha256sum /var/kiberaz/backup/ARXIV.tgz
```

`api.env`, Nginx/systemd konfiqi və aktiv release identifikatoru da bərpa üçün lazımdır. Konfiq dəyişdikdə onları ayrıca root-only arxivə sal; bu arxiv JWT/SMTP sirləri daşıyır:

```bash
sudo sh -c 'umask 077; tar -czf /var/kiberaz/backup/config-$(date -u +%Y%m%d-%H%M%S).tgz -C / etc/kiberaz etc/nginx/sites-available etc/nginx/snippets etc/systemd/system/kiberaz-api.service'
```

Testdən çıxmış release artefaktlarının ən az son iki versiyasını təhlükəsiz saxla. Git-də olmayan seed-lər də təhlükəsiz nüsxələnməlidir. Sertifikatı lazım olduqda yenidən vermək olar; backup-dan əvvəlki DNS/registrator hesablarına giriş ayrıca qorunmalıdır.

### Şifrəli xarici nüsxə

Backblaze B2 hesabı yaradarkən **EU Central** regionunu seç, private bucket yarat. Region sonradan həmin hesabda dəyişmir. Bucket-ə məhdud Application Key istifadə et. [B2 regionları](https://www.backblaze.com/docs/cloud-storage-data-regions), [rclone B2](https://rclone.org/b2/).

Serverdə interaktiv konfiqurasiyanı root kimi qur:

```bash
sudo rclone config
```

1. `b2kiberaz` adlı **B2** remote yarat: paneldən Application Key ID və Application Key daxil et. Master key istifadə etmə.
2. `kiberazcrypt` adlı **crypt** remote yarat: arxa yol `b2kiberaz:BUCKET_ADI/kiberaz`; fayl adı şifrələnməsi `standard`, qovluq adı şifrələnməsi aktiv olsun.
3. Crypt password və salt üçün ayrı güclü təsadüfi dəyərləri **serverdən kənar parol menecerində** saxla. Bunlar itərsə arxivlər açıla bilməz. Rclone config-in sadəcə obscured yazılması şifrələmə sayılmır; onu root-only saxla.

```bash
sudo chmod 600 /root/.config/rclone/rclone.conf
sudo rclone copy /var/kiberaz/backup kiberazcrypt: --include '*.tgz'
sudo rclone lsf kiberazcrypt:
```

`copy` yerli silinmələri avtomatik xaricə tətbiq etmir. Şifrələmə həm məzmunu, həm adları crypt remote üzərindən qoruyur; birbaşa `b2kiberaz:` yoluna açıq arxiv göndərmə. [rclone crypt](https://rclone.org/crypt/).

Bərpa sınağı keçdikdən sonra **root crontab**-a (`sudo crontab -e`) bir sətir əlavə et:

```cron
0 3 * * * /bin/bash /var/kiberaz/deploy/backup.sh >> /var/log/kiberaz/backup.log 2>&1 && /usr/bin/rclone copy /var/kiberaz/backup kiberazcrypt: --include '*.tgz' >> /var/log/kiberaz/backup.log 2>&1
```

Server vaxtını `timedatectl` ilə yoxla: UTC seçilibsə 03:00 UTC Bakı vaxtı ilə 07:00-dır. Az trafik saatını ona uyğun seç. Bu iş qısa xidmət dayanması yaradır; müddəti diskdəki həcmdən asılıdır, 2–3 saniyə zəmanəti yoxdur. **Cron sətri təkbaşına xəbərdarlıq göndərmir**: uğursuz job və 26 saatdan köhnə xarici backup üçün monitor xəbərdarlığı qur. Lokal **gündəlik** nüsxələr skriptdə 14 gün saxlanır; `pre-deploy`, config arxivləri və release/staging qovluqları avtomatik silinmir. Onları həftəlik disk yoxlamasına daxil et. Xarici nüsxələr üçün 30 günlük saxlanma və həftəlik həcm nəzarəti təyin et. Silmə siyasətini yalnız bərpa sınağından sonra, yeni nüsxələrin uğuru yoxlanaraq aktivləşdir.

### Bərpa sınağı və qəza zamanı sıra

**İlk açılışın keçid şərti:** bir arxivi xarici anbardan endirmək, şifrəsini açmaq, ayrıca qovluğa çıxarmaq və izolyasiya olunmuş tətbiqlə DB-ni açmaq. Canlı DB üstünə sınaq etmə.

Bu sınaqda `/var/kiberaz/restore-test` əvvəlcədən mövcud olmamalıdır. Köhnə sınaq varsa onu əvəz etmə; bütün aşağıdakı test yollarını yeni ayrıca qovluğa uyğunlaşdır. `kiberaz-...tgz` məlumat arxivini seç, `config-...tgz` faylını bu blokla çıxarma.

```bash
sudo test ! -e /var/kiberaz/restore-test
sudo install -d -o root -g kiberaz -m 750 /var/kiberaz/restore-test
sudo rclone copyto kiberazcrypt:ARXIV.tgz /var/kiberaz/restore-test/ARXIV.tgz
sudo sha256sum /var/kiberaz/restore-test/ARXIV.tgz
sudo tar -tzf /var/kiberaz/restore-test/ARXIV.tgz
```

Hash əvvəl qeydə alınmış hash ilə eyni olmalıdır. Arxiv siyahısında yalnız gözlənilən `data/`, `keys/`, `uploads/` yollarını təsdiqlə. Ayrı test qovluğunda çıxar:

```bash
sudo tar --no-same-owner -xzf /var/kiberaz/restore-test/ARXIV.tgz -C /var/kiberaz/restore-test
sudo cp -a /var/kiberaz/app/. /var/kiberaz/restore-test/app
sudo test -L /var/kiberaz/restore-test/app/wwwroot/uploads
sudo unlink /var/kiberaz/restore-test/app/wwwroot/uploads
sudo ln -s /var/kiberaz/restore-test/uploads /var/kiberaz/restore-test/app/wwwroot/uploads
sudo chown -R kiberaz:kiberaz /var/kiberaz/restore-test/data /var/kiberaz/restore-test/keys /var/kiberaz/restore-test/uploads
```

`test -L` uğursuzdursa `unlink` addımına keçmə, strukturu yoxla. Test surətinin uploads symlink-i canlı qovluğa yönəlməməlidir. Aşağıdakı test prosesi ayrıca şəbəkə sahəsindədir: internet/SMTP və ictimai portları yoxdur, canlı DB-yə yazmır. Config env-dən, **test yolları üstün prioritetli CLI parametrlərindən** gəlir:

```bash
sudo systemd-run --unit=kiberaz-restore-check --uid=kiberaz --gid=kiberaz \
  --working-directory=/var/kiberaz/restore-test/app \
  --property=EnvironmentFile=/etc/kiberaz/api.env \
  --property=PrivateNetwork=yes --property=PrivateTmp=yes \
  --property=ProtectSystem=strict --property=ProtectHome=yes \
  --property=NoNewPrivileges=yes --property=ReadWritePaths=/var/kiberaz/restore-test \
  --setenv=ASPNETCORE_ENVIRONMENT=Production \
  --setenv=DOTNET_CLI_HOME=/var/kiberaz/restore-test/data \
  /usr/bin/dotnet /var/kiberaz/restore-test/app/Kiberaz.Api.dll \
  --urls http://127.0.0.1:5099 \
  --ConnectionStrings:LiteDb 'Filename=/var/kiberaz/restore-test/data/Kiberaz.db;Connection=shared' \
  --DataProtection:KeysPath /var/kiberaz/restore-test/keys
sudo systemctl status kiberaz-restore-check --no-pager
sudo nsenter -t "$(systemctl show -p MainPID --value kiberaz-restore-check)" -n \
  curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
  -H 'Host: api.kiberaz.az' -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:5099/api/Quiz/categories
sudo systemctl stop kiberaz-restore-check
```

Status/API cavabı və restored upload fayllarının mövcudluğu yoxlanır. Bu əmrlər real serverdə hələ icra edilməyib; ilk sınaqda xəta olarsa bunu **BLOCKED** kimi qeyd et. Test qovluğunu yalnız nəticə qeydə alındıqdan sonra idarə et; bütün `/var/kiberaz` yolunu silmə.

**Real qəza bərpası** ayrıca maintenance əməliyyatıdır: API-ni dayandır → cari zədələnmiş data/keys/uploads-u ayrıca saxla → birlikdə seçilmiş nüsxəni boş qovluqlara bərpa et → əvvəlki uyumlu release/config və sahibliyi bərpa et → API-ni başlat → health+DB+login+fayl sınağı et. Yeni bazanın üstünə köhnə `.db` faylını canlı proses işləyərkən kopyalama. Gündəlik backup ilə son uğurlu nüsxədən sonrakı **24 saata qədər məlumat itkisi** mümkündür; real bərpa müddəti sınaqda ölçülməlidir.

## 10. Sonrakı yeniləmə, rollback və gündəlik nəzarət

Hər yeniləmədə eyni sıra: lokal predeploy → yalnız təmiz API/UI artefaktları → `incoming/` → `sudo bash /var/kiberaz/deploy/deploy.sh` → health və kritik brauzer sınaqları. DB, keys və uploads release ilə əvəz olunmur. Deploy/backup eyni maintenance kilidini istifadə edir; eyni anda ikinci əl ilə DB prosesi açma.

Əvvəlki uğurlu buraxılış varsa:

```bash
sudo bash /var/kiberaz/deploy/deploy.sh rollback
curl --fail --show-error --silent https://api.kiberaz.az/health
```

Rollback API+UI-ni əvvəlki birlikdə saxlanmış release-ə qaytarır. **Bu, DB restore deyil.** Yeni kodun startup backfill-i və ya məlumat formatı köhnə versiya ilə uyğun deyilsə, sadə rollback kifayət etmir; uyğun release və birlikdə alınmış backup ilə maintenance restore tələb olunur. İlk deploy-da əvvəlki release yoxdur.

| Tezlik | Nəyi yoxla | Problem olarsa |
|---|---|---|
| Hər 5 dəqiqə | Xaricdən `https://api.kiberaz.az/health`, ana səhifə və TLS müddəti | Uptime monitor xəbərdarlığı; əvvəl Nginx/API statusu və journal |
| Gündəlik | Son **xarici** backup tarixi, job çıxışı | 26 saatdan köhnə nüsxədə xəbərdarlıq və əl ilə araşdırma |
| Gündəlik ilk həftə | `df -h`, RAM/CPU, xidmət restartları, SMTP delivery log | Disk 80%-ə çatmadan arxiv/kvota/tutum qərarı; səbəbsiz restart varsa araşdırma |
| Həftəlik | OS/.NET təhlükəsizlik yeniləmələri, server hesabı/xərc limiti | Backup → yeniləmə → lazım olsa reboot → smoke test |
| Aylıq və böyük dəyişiklikdən sonra | Xarici backup-dan izolyasiya edilmiş bərpa | Nəticə uğursuzdursa backup-u işlək sayma |
| Oktyabr 2026 | .NET 10 keçidinin hazırlığı | 10.11.2026 dəstək sonuna qədər ayrıca təsdiqlənmiş keçid |

Faydalı server əmrləri:

```bash
sudo systemctl is-active kiberaz-api nginx
sudo journalctl -u kiberaz-api --since '30 minutes ago' --no-pager
sudo tail -n 40 /var/log/kiberaz/backup.log
df -h /var/kiberaz
free -h
sudo systemctl show kiberaz-api -p NRestarts -p MemoryCurrent
```

Logları paylaşmazdan əvvəl hesab/e-poçt, token, cookie və digər şəxsi məlumatları çıxar. Backup logunun ölçüsü üçün logrotate saxlanma qaydası qur. Monitor mövcud olmadığı halda “sayt izlənilir” demə; ən azı gündəlik əl ilə status+backup nəzarəti et və ictimai açılışdan əvvəl xəbərdarlığı sınaqdan keçir.

## 11. “Canlıya hazırdır” qərarı

| Mərhələ | Bu sənəddən əldə edilən | Tamamlanması üçün sübut |
|---|---|---|
| Lokal kod/artefakt | İcra ediləcək gate və paket yolları | Cari işçi ağacında uğurlu build/test/audit nəticələri |
| Server | Ölçü, OS, xidmət və firewall planı | Real VPS/SSH, runtime, port və icazə yoxlamaları |
| DNS/TLS | Dəqiq hostlar və bootstrap | DNS cavabı, sertifikat, yenilənmə dry-run |
| Auth/SMTP/CAPTCHA | Ayarlar və sahib bootstrap yolu | Real domendə öz hesabı ilə tamamlanmış axınlar |
| Məlumat dayanıqlığı | Daimi yollar, lokal+xarici backup planı | Restart sonrası məlumat, offsite nüsxə və restore sınağı |
| İstismar | Monitor və rollback qaydası | Xəbərdarlıq sınağı, əvvəlki release, xərc nəzarəti |

**İctimai açılış:** bu keçid şərtləri təmin ediləndə. Təkcə build-in və `/health`-in yaşıl olması production-un bütünlüklə yoxlandığı demək deyil.
