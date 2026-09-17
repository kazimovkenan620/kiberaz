# Frontend regressiya yoxlamaları

`frontend-regressions.mjs` mövcud React komponentlərini Chrome-da, `StrictMode` ilə yoxlayır. Müvəqqəti Vite serveri boş lokal port seçir; API cavabları yalnız brauzer daxilində imitasiya olunur. Tətbiqin bazasına, işləyən API-yə və istifadəçinin brauzer profilinə toxunulmur. Token və parol dəyərləri çıxışa yazılmır; fixture məlumatları sintetikdir.

Node, layihənin mövcud `node_modules` qovluğu, quraşdırılmış Chrome və Playwright lazımdır. Paket manifestinə əlavə asılılıq daxil edilməyib. Mövcud Playwright quraşdırmasına yol göstərmək üçün, `kiberaz-ui` qovluğundan:

```powershell
$env:PLAYWRIGHT_MODULE_PATH='C:\path\to\playwright\index.mjs'
node tests/frontend-regressions.mjs
```

Playwright adi modul həllində əlçatandırsa dəyişəni buraxmaq olar. Hər ssenari ayrıca brauzer kontekstində işləyir, xəta olduqda proses qeyri-sıfır kodla bitir.

Yoxlamalar:

- Tokenin yalnız yaddaşda saxlanması, hər iki storage-dakı köhnə açarların təmizlənməsi.
- StrictMode, reload və yeni tab üçün tək refresh; paralel 401 sorğuları; logout.
- Gecikmiş refresh/login/Google cavabının çıxışı ləğv etməməsi; müvəqqəti server xətasında bərpa işarəsinin qalması.
- Köhnə API sorğusunun yeni sessiyanı silməməsi və başqa hesabla təkrarlanmaması; yeni sessiyanın refresh-inin köhnə gözləyən sorğudan ayrılması.
- Google callback zamanı köhnə sessiya işarəsinin əlavə bootstrap refresh başlatmaması; etibarsız cookie üçün faktiki `400` cavabının işarəni silməsi.
- Lokal mesajdan asılı olmayan resend və 429 cavabının görünməsi.
- Mouse/klaviatura açılışı, `autoFocus`, auth pəncərələrinin dəyişməsi, iç modal və silinmiş trigger üçün fokus bərpası.
- İdarə olunan saatla 10 saniyəlik geri sayım, köhnə server snapshot-ından sonra vaxtın artmaması, dayandırılmış intervaldan sonra deadline, tək avtomatik göndəriş və açıq retry.
- Gözləmədə qalan cavabın deadline göndərişini bloklamaması və sonradan gələn snapshot-ın yekun nəticəni geri çevirməməsi.

Bu sınaqlar real cookie, server scoring və təhlükəsizlik siyasətini imitasiya etmir; həmin sərhədlər ayrıca API və production-build brauzer yoxlamasında təsdiqlənməlidir.
