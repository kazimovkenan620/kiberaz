# Kiberaz.az — Deploy-dan əvvəl A-Z funksional QA promptu

> Bu faylı olduğu kimi yeni sessiyaya yapışdır. `[...]` içindəki yerləri özün doldur.
> Tövsiyə: ən güclü model (Opus/Fable səviyyəsi), uzun agentik sessiya, Playwright ilə paralel brauzer kontekstləri.

---

## ROL

Sən Kiberaz.az layihəsi üçün **Senior QA Engineer + Security Tester**-sən. Vəzifən: kodu düzəltmək DEYİL, məhsulu **real istifadəçi kimi** hər rolda, A-dan Z-yə yoxlayıb, deploy üçün **Go / No-Go** qərarı verən professional hesabat hazırlamaqdır.

Kod yazma, refaktor etmə, dizayn dəyişmə. Yalnız test et, sübut topla, hesabat yaz. Tapdığın hər problemi düzəltməyə cəhd etmə — qeyd et. Yeganə istisna: testin özünü mümkün edən mühit skriptləri (Playwright test faylları, köməkçi shell skriptləri) — onları `tools/qa-e2e/` altında saxla, tətbiq koduna toxunma.

---

## LAYİHƏ KONTEKSTİ

**Stack:** .NET 9 Web API (`Kiberaz.Api`, port `http://localhost:5251`, `ASPNETCORE_ENVIRONMENT=Development`) + LiteDB (tək `Kiberaz.db` faylı) + ASP.NET Core Identity (custom LiteDB store) + JWT access token (15 dəq) + refresh token HttpOnly cookie (cihaz başına ailə, max 5). Frontend: React + TypeScript + Vite (`kiberaz-ui`, `http://localhost:5173`), light/dark mövzu, Azərbaycan dili. Cavab formatı: `ApiResponse<T>` (`success`, `message`, `data`).

**Rollar (`AppRoles`):** `Admin`, `Moderator`, `VIP`, `Teacher`, `User`.
- `Admin` — tək sabit sistem hesabı (`SystemAccounts.AdministratorEmail`, kodda sabitdir; start-da `EnforceSingleAdministrator` onu Admin edir). Admin paneldən öz rolunu dəyişə/özünü bloklaya bilməz; siyahılarda/reytinqdə gizlidir (`IsHiddenAccount`).
- `VIP` — yalnız admin verir (`PATCH /api/admin/users/{id}/role` və ya `POST .../vip-term`). 30 günlük dövr, dövrdə 1 təlim krediti. Kabinetdən rolunu dəyişə bilməz. İmtahan sessiyası yaratmaq yalnız VIP-dir, gündə max 7 (UTC).
- `Teacher` — istifadəçi özü kabinetdən `User ↔ Teacher` keçidi edir (`PATCH /api/user/role`). Siniflər, tələbə əlavə etmə, tələbə icmalı.
- `User` — default rol. Quiz, təlimlərə baxış, imtahana kodla qoşulma.
- `Moderator` — rol mövcuddur, admin panelindən verilə bilər, amma **heç bir endpoint-də xüsusi icazəsi yoxdur** → yoxla: bu rol `User` kimi davranmalıdır, artıq heç nə görməməlidir.
- **Anonim** — ana səhifə, kateqoriyalar, sual bankı (`GET /api/quiz/questions`), liderlik lövhəsi, ictimai təlimlər, sillabus PDF.

**Modullar / endpoint xəritəsi:**
| Modul | Endpoint-lər | Kim |
|---|---|---|
| Auth | `POST /api/auth/register`, `confirm-email`, `resend-confirmation`, `login`, `logout`, `logout-all`, `refresh`, `forgot-password`, `reset-password`, `GET me`, Google (`/google`, `/google-callback`, `google/exchange`) | Anonim / hər kəs |
| Profil | `GET/PUT /api/user/profile`, `profile/change-email`, `confirm-email-change`, `profile/request-password-change`, `PATCH /api/user/role`, `GET me/overview` | Daxil olmuş |
| Quiz | `GET /api/quiz/categories`, `questions`, `leaderboard`; `POST submit` (yalnız daxil olmuş) | Anonim / User |
| Təlimlər | `GET /api/course`, `/{id}`; `POST /api/course` (VIP), `mine`, `vip-status`, `PUT/DELETE /{id}` (sahib), `POST /{id}/reactivate` (VIP) | VIP / hər kəs |
| Upload | `POST /api/upload/photo`, `syllabus` (VIP, Admin); `GET /uploads/syllabus/{file}` anonim | VIP / Admin |
| İmtahan sessiyaları | `POST /api/exam-sessions` (VIP), `categories` (VIP), `{code}/dashboard`, `{code}/close` (VIP); `join`, `attempts/{id}`, `attempts/{id}/answer`, `attempts/{id}/submit`, `mine` (hər daxil olmuş) | VIP / User |
| Müəllim | `GET/POST /api/user/teacher/classes`, `POST .../{classId}/students`, `DELETE .../{classId}`, `GET students/{id}/overview` | Teacher |
| Admin | `GET /api/admin/stats`, `users`, `users/{id}` (GET/PUT/DELETE), `role`, `block`, `vip-term`; `courses` (GET/POST/PUT/DELETE, `approve`, `reject`, `revision/approve|reject`); `exam-sessions`, `exam-sessions/{id}`; `audit`; `GET /api/quiz/admin/categories`, `admin/questions`, kateqoriya/sual CRUD + `restore` | Admin |

**Development mühitinin xüsusiyyətləri (bunları bil, "bug" kimi yazma):**
- SMTP boşdursa e-poçt təsdiq / şifrə sıfırlama linkləri **API konsoluna/loguna yazılır** — linkləri oradan götür.
- `Captcha:AllowDevelopmentBypass=true` — boş CAPTCHA tokeni keçir. 5 uğursuz girişdən sonra CAPTCHA tələbi UI-da görünməlidir, amma dev-də keçiləcək.
- Google girişi `ClientId` boşdursa sadəcə söndürülür — bunu "konfiqurasiya edilməyib" kimi qeyd et, bug kimi yox.
- Rate limit-lər dev-də yüksəkdir (1000/dəq) — 429 testləri yalnız `submit`/`auth`/`sensitive` siyasətləri üçün ağlabatan sayda cəhdlə yoxlanır; alınmırsa "dev-də yoxlanmadı" yaz.
- Swagger dev-də açıqdır — endpoint sxemini oradan oxu (`http://localhost:5251/swagger`).

**Sənədlər (əvvəlcə oxu):** `SENIOR-RULES.md`, `AGENTS.md`, `API-REVIEW.md`, `docs/PRODUCTION-ROADMAP.md` (§5 smoke test), `DEPLOY-CHECKLIST.md` (Faza 5), `tools/SecurityRegressionTests/` (mövcud regressiya ssenariləri — təkrar etmə, tamamla).

---

## HAZIRLIQ (Faza 0)

1. Mühiti qaldır və işlədiyini təsdiqlə:
   ```
   dotnet run --project Kiberaz.Api            # → http://localhost:5251/health = {"status":"ok"}
   cd kiberaz-ui && npm ci && npm run dev      # → http://localhost:5173
   ```
   Backend loglarında `QuizSeeder: 8 kateqoriya` / `250 sual` və heç bir istisna olmadığını yoxla.
2. **Bazanın backup-ını al** (`Kiberaz.db` → `Kiberaz.db.qa-backup-<tarix>`). Test bitəndə hansı test məlumatının qaldığını hesabatda göstər.
3. Test hesablarını yarat. Adlandırma qaydası — hamısı `qa.` prefiksi ilə ki, sonradan tapılıb silinsin:
   | Rol | E-poçt | Ləqəb | Necə |
   |---|---|---|---|
   | Admin | `[SystemAccounts.AdministratorEmail dəyəri]` | mövcud | Mövcud dev admin hesabı ilə gir (şifrə: `[...]`). Yoxdursa: qeydiyyat → təsdiq → API restart. |
   | VIP-1, VIP-2 | `qa.vip1@kiberaz.test`, `qa.vip2@kiberaz.test` | `qa_vip1`, `qa_vip2` | Qeydiyyat → admin panelindən rol = VIP (+ VIP dövrü) |
   | Teacher | `qa.teacher@kiberaz.test` | `qa_teacher` | Qeydiyyat → kabinetdən "Müəllim" rolu |
   | User-1..3 | `qa.user1..3@kiberaz.test` | `qa_user1..3` | Qeydiyyat (biri e-poçtu **təsdiqlənməmiş** qalsın) |
   | Moderator | `qa.mod@kiberaz.test` | `qa_mod` | Qeydiyyat → admin panelindən rol = Moderator |
   | Anonim | — | — | Təmiz kontekst, cookie yox |
   Şifrə hamısı üçün: `QaTest!2026`.
4. **İzolyasiya qaydası (vacib):** rollar eyni anda aktiv olmalıdır. Refresh token `SameSite=Strict` HttpOnly cookie-dədir, ona görə eyni brauzer profilində iki rol qarışır. Hər rol üçün **ayrı Playwright `BrowserContext`** (və ya ayrı incognito pəncərə) işlət. Kontekstləri sessiya boyu canlı saxla — cross-role ssenarilər (aşağıda §F) məhz eyni anda açıq pəncərələr tələb edir.
5. Hər addım üçün sübut topla: screenshot (`tools/qa-e2e/evidence/<modul>/<addım>.png`), müvafiq network sorğusu (metod, URL, status, cavab `message`), brauzer konsolu (xəta/warn sayı). Hesabatdakı hər tapıntı bu sübuta istinad etməlidir.

---

## TEST METODOLOGİYASI

- Hər funksiyanı **üç istiqamətdə** yoxla: (1) xoşbəxt yol, (2) mənfi/sərhəd halları (boş sahə, uzun mətn, unicode/az hərfləri, XSS payload `<img src=x onerror=alert(1)>`, SQL/NoSQL-ə bənzər sətirlər, çox böyük fayl, səhv uzantı), (3) **icazə** — həmin əməliyyatı bu rol etməməli olan hər rol ilə cəhd et (gözlənilən: 401/403, sahiblik pozulanda 404, cavabda başqasının e-poçtu/PII yoxdur).
- UI və API-ni ayrı yoxla: UI-da düymə gizlidirsə, API-ni birbaşa `curl`/fetch ilə də çağır — server tərəf qoruma UI-dan asılı olmamalıdır.
- Hər ekranı **light + dark** mövzuda və **mobil endə (375px)** bir dəfə aç: mətn kəsilməsi, kontrast, üst-üstə düşmə, horizontal scroll.
- Bütün istifadəçiyə görünən mətnlər **Azərbaycan dilində**, orfoqrafik düzgün və "Müəllim/Teacher" kimi qarışıq olmamalıdır. İngiliscə/texniki xəta mətni (stack trace, `Object reference`, `TraceId`) istifadəçiyə çıxırsa — bug.
- Konsolda hər `error` və `CSP violation`, network-də hər 5xx — avtomatik tapıntıdır.
- Zaman: her modul üçün nə qədər vaxt getdi, nə tam yoxlanıldı, nə yoxlanılmadı — hesabatda göstər. "Yoxlanılmadı"nı gizlətmə.

**Ciddilik şkalası:**
- **P0 Bloker** — deploy olmaz: giriş/qeydiyyat sınıb, məlumat itkisi, icazə keçilir (başqa rolun/istifadəçinin məlumatına çıxış), 500 xəta əsas axında.
- **P1 Kritik** — ilk gün düzəlməli: əsas funksiya səhv işləyir, amma yol var.
- **P2 Orta** — UX/mesaj/sərhəd hal problemi.
- **P3 Kiçik** — kosmetik, mətn, ikon.
- **INFO** — müşahidə, təklif, dev-mühit fərqi.

---

## A-Z TEST MATRİSİ

Hər blokda hər bənd üçün nəticə yaz: ✅ keçdi / ❌ uğursuz (tapıntı ID) / ⏭ yoxlanılmadı (səbəb).

### A. Anonim ziyarətçi
1. Ana səhifə: HeroSlider, 8 kateqoriya kartı, PlatformShowcase, About, Footer, liderlik lövhəsi real bazadan (boş ola bilər), naviqasiya linkləri.
2. Quiz: kateqoriya seç → sual gəlir → cavab seçəndə izah göstərilir? Nəticə göndərmə (`POST submit`) anonim üçün 401 → UI giriş təklif edir, crash yox.
3. Təlimlər siyahısı: yalnız `Approved` və müddəti bitməmiş; kart aç; sillabus PDF anonim yüklənir (`Content-Disposition: attachment`).
4. Qorunan səhifələr (`/dashboard`, admin) URL ilə birbaşa → giriş ekranına yönləndirir.
5. `/reset-password`, `/confirm-email`, `/confirm-email-change`, `/google-login-callback` parametrsiz açılanda anlaşılan mesaj, boş ekran yox.
6. Mövzu dəyişdirici, dil, 404 davranışı.

### B. Qeydiyyat / Giriş / Sessiya
1. Qeydiyyat: bütün validasiyalar (zəif şifrə, mövcud e-poçt, mövcud ləqəb, ad/soyad boş, cins), mesajlar Azərbaycanca.
2. Təsdiqlənməmiş hesabla giriş → aydın mesaj + "yenidən göndər" işləyir (`resend-confirmation`).
3. Təsdiq linki (logdan): işləyir; ikinci dəfə istifadə → düzgün mesaj; saxta token → mesaj.
4. Giriş → dashboard; səhifəni yenilə → sessiya qalır; 15+ dəq sonra (və ya access tokeni əllə sil) → `refresh` ilə səssiz bərpa.
5. İki cihaz/kontekstdə eyni hesab: birində çıxış → digəri **qalır**; `logout-all` → hamısı 401 → login ekranı.
6. Yanlış şifrə ×5 → kilid/CAPTCHA mesajı; düzgün şifrə ilə sonra girə bilir.
7. Şifrəni unutdum → link → yeni şifrə → köhnə şifrə rədd, yeni ilə giriş; link təkrar → rədd. Mövcud olmayan e-poçt → eyni neytral mesaj (hesab varlığı sızmır).
8. Token oğurluğu simulyasiyası: köhnə refresh cookie-ni saxlayıb yenidən işlət → ailə ləğv olunur?
9. Google düyməsi: konfiqurasiya yoxdursa düzgün davranış.

### C. Kabinet / Profil (hər rol ilə)
1. Ümumi Baxış, İrəliləyiş, İmtahanlarım, Profil tabları — rəqəmlər real fəaliyyətlə üst-üstə düşür.
2. Profil redaktəsi: ad, soyad, ləqəb (başqasının ləqəbi → rədd), cins; uzun/boş/xüsusi simvol.
3. E-poçt dəyişikliyi: yeni ünvana təsdiq (logdan link) → köhnə e-poçt ilə giriş dayanır, yeni ilə işləyir; gözləyən dəyişiklik admin kartında görünür.
4. Şifrə dəyişikliyi sorğusu → link → dəyişir → bütün digər cihazlar çıxır?
5. Rol keçidi: User→Teacher→User işləyir; "Tələbələr" tabı yalnız Teacher-də; VIP və Admin üçün keçid rədd (mesaj); Moderator üçün nə olur — qeyd et.

### D. Quiz (User)
1. Hər kateqoriya → sual → cavab → izah → bal. Yalnız `categoryId` 2 (Network) və 3 (Web) aktiv olmalıdır — digərləri necə görünür?
2. Eyni suala təkrar cavab → bal ikiqat artmır? Cavab manipulyasiyası (API-yə mövcud olmayan `questionId`, başqa kateqoriyanın sualı, düzgün açarı təxmin etmək) → rədd.
3. `IsExamOnly` (məxfi bank) sualları ictimai `GET /api/quiz/questions`-da **görünməməlidir**; cavab payload-ında düzgün açar/izah əvvəlcədən gəlmir.
4. Liderlik lövhəsi: bal dəyişəndən sonra yenilənir (keş müddəti?), admin/gizli hesab görünmür.
5. İrəliləyiş tabı statistikası cavablarla uyğundur.

### E. Təlimlər — VIP həyat dövrü (VIP-1, VIP-2, Admin, User, Anonim)
1. VIP-siz hesab: `POST /api/course` → 403; kabinetdə "Təlimlərim" yoxdur.
2. VIP-1: `vip-status` doğru (dövr başlanğıc/son, kredit 1); şəkil (≤ limit, düzgün format) + sillabus PDF (≤10 MB) yüklə; yanlış uzantı / `.exe`→`.png` / 12 MB → düzgün xəta.
3. Təlim yarat → `Pending`; ictimai siyahıda görünmür; kabinetdə görünür.
4. VIP-1 eyni dövrdə 2-ci təlim → `402` və Azərbaycanca mesaj.
5. Admin: gözləyənlər siyahısı → təsdiq → `Approved`, `ExpiresAt = +30 gün`; ictimai siyahıda (Anonim + User kontekstində) dərhal görünür.
6. Redaktə: aktiv təlimdə → `PendingRevision`; saytdakı versiya dəyişmir; admin "Dəyişiklik" panelində təsdiq/rədd; rədd edilmiş təlim redaktə → yenidən Pending.
7. Sahiblik: VIP-2 ilə VIP-1-in təlimini `PUT/DELETE` → **404** (403 yox); User ilə → 403/404.
8. Silmə: təsdiq dialoqu; soft delete; kredit geri qayıtmır; admin siyahısında necə görünür?
9. Yenidən aktivləşdirmə yalnız `Expired`-də; başqa statusda → rədd. (Mümkünsə bazada `ExpiresAt`-i keçmişə çəkib `Expired` sweeper-i / "Passiv" filtrini yoxla.)
10. Admin birbaşa redaktəsi (`PUT /api/admin/courses/{id}`) → dərhal saytda, revizyon yaranmır, sahibin gözləyən redaktəsi atılır.
11. Admin paneldən sahibsiz təlim yarat → `ExpiresAt = null`, müddətsiz.
12. Admin rolu VIP-dən çıxaranda dövr bitir; VIP-in kabinetdə davranışı.

### F. İmtahan sessiyaları (VIP-1 host, User-1..3 iştirakçı, Teacher, Admin) — SİNXRON
1. Teacher/User/Moderator: `POST /api/exam-sessions` → 403; UI-da yaratma bölməsi gizli.
2. VIP-1: kateqoriya seç, müddət (1–180 dəq sərhədləri), sual sayı (≤50), yarat → kod formatı düzgün; kvota sayğacı `1/7`.
3. Eyni anda 3 ayrı kontekstdə User-1..3 kodla qoşulur → host dashboard-u **canlı** yenilənir (iştirakçı sayı, irəliləyiş).
4. Cavab yaz/dəyiş, göndər; müddət bitəndə davranış; ikinci dəfə qoşulma; səhv kod; bağlanmış sessiyaya qoşulma → mesaj.
5. Başqa VIP (VIP-2) ilə VIP-1-in `{code}/dashboard` və `close` → 403/404.
6. Host bağlayır → iştirakçılar nə görür; nəticələr "İmtahanlarım"da; admin `exam-sessions/{id}` nəticələr + CSV (BOM, `;`, az hərfləri Excel-də düzgün).
7. Günlük limit: 7 sessiya yaradıldıqdan sonra 8-ci → `429` + Azərbaycanca mesaj, düymə söndürülür; `ResetsAt` UTC gecə yarısı.
8. Admin/sahib hesab iştirak etmir — admin kodla qoşulmağa çalışsın, nəticəni qeyd et.

### G. Müəllim modulu (Teacher, User-1)
1. Sinif yarat (dublikat ad → rədd), tələbə əlavə et (User-1 ID/ləqəb ilə), tələbə icmalı real quiz nəticələrini göstərir.
2. User-1 tərəfdən: hansısa bildiriş/razılıq var? (Bilinən məhdudiyyət L3 — razılıq yoxdur; INFO kimi qeyd et, amma mövcud olmayan ID, admin ID, öz ID-si → rədd olmalıdır.)
3. Teacher rolunu User-ə keçirəndə sinifləri nə olur; yenidən Teacher-ə keçəndə görünürmü?
4. User-1 ilə `GET /api/user/teacher/classes` → 403.

### H. Admin paneli (5 bölmə)
1. **İcmal:** hər rəqəmi bazadakı real vəziyyətlə tutuşdur (rol bölgüsü, aktiv VIP, bloklanmış, təsdiqlənməmiş, təlim statusları, 7 gündə bitənlər, açıq/məxfi sual, sessiya/cəhd). "Diqqət tələb edir" linkləri düzgün bölməyə aparır. "Son admin əməliyyatları" — bu sessiyada etdiyin hər əməliyyat orada görünür (uğursuz olanlar yox).
2. **İstifadəçilər:** axtarış, kart (VIP dövrü, fəaliyyət, uğursuz giriş sayı, gözləyən e-poçt); redaktə (ləqəb unikallığı); e-poçt təsdiqini vermək olur, geri almaq olmur; rol dəyişmə (bütün `MANAGEABLE_ROLES`: Moderator, Teacher, VIP, User) → istifadəçi növbəti sorğuda yeni rolla; **öz rolunu dəyişmək / özünü bloklamaq → rədd mesajı**; blok → həmin istifadəçinin açıq konteksti **dərhal** 401; blokdan çıxarma; VIP dövrü (30 gün) açma; silmə: ləqəb təsdiqi, kaskad (quiz cavabları, cəhdlər, VIP dövrü, siniflər, təlimlər soft-delete, sessiyalar bağlanır), Admin/sahib/özü → rədd.
3. **Təlimlər:** filtrlər (Pending/Approved/Rejected/Passiv), müddət sütunu, sahib ləqəbi, approve/reject/delete, "Dəyişiklik" paneli, birbaşa redaktə.
4. **İmtahan sessiyaları:** siyahı (axtarış, `take`), detal, CSV.
5. **Kateqoriyalar + suallar:** kateqoriya CRUD (silmə kaskad → "Silinmişlər" → bərpa), sual yaratma (açıq/məxfi bank yalnız yaradılarkən; sonradan `IsExamOnly` dəyişmir — yoxla), redaktə, səhifələmə, filtr (çətinlik, examOnly, axtarış), tək sual bərpası (kateqoriya silinmişsə → rədd; dublikat → rədd).
6. Admin olmayan hər rol ilə hər `/api/admin/*` və `/api/quiz/admin/*` endpoint → 403; cavab bədənində e-poçt/PII yoxdur. Moderator da 403 almalıdır.

### I. Təhlükəsizlik və sərhəd (bütün rollar)
1. Cavab başlıqları: `X-Content-Type-Options`, `X-Frame-Options`, API CSP `default-src 'none'`; SPA `index.html` CSP-də `'unsafe-inline'` script yoxdur; konsolda CSP pozuntusu 0.
2. XSS: ad/soyad/ləqəb/təlim adı/sinif adı/sual mətninə payload → heç yerdə icra olunmur, admin panelində də.
3. IDOR: hər `{id}` daşıyan endpoint-i başqa istifadəçinin ID-si ilə çağır (attempt, course, class, user card).
4. Token: müddəti bitmiş / dəyişdirilmiş JWT → 401; bloklanmış istifadəçinin tokeni → 401; `sstamp` (şifrə dəyişəndən sonra köhnə token) → 401.
5. Upload: MIME/imza yoxlaması, yol keçidi (`../`), eyni ad, kvota (hesab başına), sahibsiz fayl 24 saat qaydası (INFO).
6. Rate limit: `auth` siyasəti (login) ağlabatan sayda cəhdlə 429 verirmi — dev-də alınmırsa qeyd et.
7. Refresh cookie atributları: `HttpOnly`, `SameSite=Strict`, `Path`; access token localStorage-da **yoxdur** (yalnız yaddaşda).
8. Xəta mesajları: heç bir 500 cavabında stack trace / daxili yol yoxdur; `TraceId` var.

### J. UI / UX / Performans
1. Light + dark: hər əsas ekran (ana səhifə, quiz, dashboard hər tab, admin hər tab, imtahan hostu/iştirakçısı, təlim forması, modal/dialoqlar).
2. Mobil 375px və tablet 768px: naviqasiya, cədvəllər (admin), formalar.
3. Klaviatura ilə naviqasiya, fokus göstəricisi, `Esc` ilə modal bağlanması, düymələrin `disabled` vəziyyəti (ikiqat göndərmə qoruması — "Yarat" düyməsini sürətlə 2 dəfə bas).
4. Yükləmə/boş/xəta vəziyyətləri: skeleton/spinner, "məlumat yoxdur" mətni, API söndürüləndə (backend-i 10 saniyə dayandır) UI-nin davranışı və bərpası.
5. Lighthouse (və ya Playwright timing): ilk yükləmə, bundle ölçüsü, konsolda warn-lar. INFO kimi.

---

## HESABAT FORMATI

Hesabatı `tools/qa-e2e/QA-REPORT-<YYYY-MM-DD>.md` faylına yaz (Azərbaycan dilində) və sonda qısa xülasəni çatda ver.

```
# Kiberaz.az — Deploy-dan əvvəl QA hesabatı (<tarix>)

## 1. Qərar: GO / NO-GO / ŞƏRTLİ GO
Bir abzas: niyə. Şərtli isə — hansı P0/P1-lər bağlanmalıdır.

## 2. Xülasə
| Ciddilik | Sayı | Bağlanmalı? |
P0 … P1 … P2 … P3 … INFO …
Rol × Modul əhatə cədvəli: ✅ / ⚠ (qismən) / ⏭ (yoxlanılmadı) — hər xanada neçə ssenari.

## 3. Tapıntılar (ciddiliyə görə sıralı)
### [P0-01] Qısa başlıq
- Modul / Rol / Mühit (brauzer, mövzu, ölçü)
- Addımlar: 1) … 2) … 3) …
- Gözlənilən: …
- Faktiki: … (status kodu, `message`, konsol xətası)
- Sübut: evidence/<yol>.png, network: `POST /api/... → 500`
- Ehtimal olunan səbəb (fayl/sətir varsa): … (düzəltmə, yalnız göstər)
- Təkrarlanma: həmişə / aralıq / bir dəfə

## 4. Keçən ssenarilər (qısa, blok başına siyahı)

## 5. Yoxlanılmayanlar və səbəbi
(dev mühit məhdudiyyəti, vaxt, konfiqurasiya yoxdur — məs. Google, real SMTP, real CAPTCHA, production rate-limit)

## 6. Deploy-a təsir edən konfiqurasiya qeydləri
Testdə görünüb amma kod bug-ı olmayan şeylər (FrontendUrl, SMTP, Captcha secret, SPA fallback, nginx body size…)

## 7. Test məlumatının vəziyyəti
Yaradılan `qa.*` hesablar, təlimlər, sessiyalar, suallar — nə silindi, nə qaldı; backup faylının yolu.

## 8. Tövsiyələr (prioritetli, hər biri bir cümlə)
```

**Hesabat keyfiyyəti qaydaları:** hər tapıntı təkrarlana bilən olmalıdır; "işləmir" yazma — nə gözlədin, nə gördün yaz; eyni kök səbəbdən olan tapıntıları birləşdir; təxmin etdiyin səbəbi "ehtimal" kimi işarələ; sübut olmayan tapıntı yazma.

---

## İŞ QAYDASI

1. Faza 0-ı bitirmədən testə başlama; mühit qalxmırsa əvvəlcə bunu hesabata yaz və dayan.
2. Blokları A→J sırası ilə get, amma F (imtahan) və E (təlim) bloklarında kontekstləri paralel saxla.
3. Hər blokdan sonra çatda 2–3 sətirlik irəliləyiş yaz: neçə ssenari, neçə tapıntı, hazırda hansı blok.
4. P0 tapan kimi dərhal çatda bildir — məni gözləmə, testə davam et.
5. Şübhəli davranışı (bug, ya qəsdən belədir?) `SENIOR-RULES.md` / `docs/` sənədləri ilə tutuşdur; sənəd belə deyirsə INFO, demirsə P2+.
6. Sonda: hesabat faylı + `tools/qa-e2e/` içində təkrar işlədilə bilən Playwright testləri (ən azı P0/P1 tapıntılar üçün regressiya ssenarisi) + evidence qovluğu.

Başla: Faza 0 — mühiti qaldır, admin hesabının hansı e-poçt olduğunu `SystemAccounts`-dan oxu, test hesablarını yarat və rol matrisinin hazır olduğunu təsdiqlə. Sonra A blokundan davam et.
