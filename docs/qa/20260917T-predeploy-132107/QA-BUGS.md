# Deploy öncəsi təsdiqlənmiş qüsurlar

Bu sənəd yalnız **6 təsdiqlənmiş qüsuru** əhatə edir: 2 P1, 3 P2, 1 P3. Production koduna düzəliş edilməyib. Sınaq nəticəsi, kök səbəb və sübutun məhdudiyyəti ayrıca göstərilir; inventardakı digər statik namizədlər bu siyahıya avtomatik köçürülməyib.

## Ümumi icra konteksti

- **Run:** `20260917T-predeploy-132107`; başlanğıc `2026-09-17T13:21:07.1310857+04:00`.
- **Commit:** `2a3f32f4e131fda77d668215c4ea83af20a6f8b5`; branch `feat/ui-migration-light-dark`.
- **Mühit:** Windows `10.0.26200`; .NET SDK `10.0.401`, tətbiq net9.0, yerli runtime `9.0.0`; Node `24.16.0`, npm `11.13.0`.
- **Brauzer:** installed Chrome/Chromium `153.0.8010.47`; Playwright `1.58.2`; production frontend build + izolə yerli Development API (`localhost:5259`), ayrı hesab kontekstləri. Bu, real production hosting E2E-si deyil.
- **Məlumat:** yalnız auditin ayrıca temp bazası, sintetik hesablar və uploads. Hesablar aşağıda alias-la göstərilir; credential, cookie və token dəyərləri açıqlanmır.
- **Mənbə:** [run.json](run.json), [QA-PLAN.md](QA-PLAN.md), [browser-engine.json](evidence/browser-engine.json). Aşağıdakı bütün qüsurlar bu run/commit-ə aiddir; release paketi də həmin run-ın publish çıxışıdır.
- **Prioritet:** P1 release üçün yüksək təsir, P2 əhəmiyyətli müqavilə/axın pozuntusu, P3 əlçatanlıq qüsuru. Bunlar ssenari JSON-undakı icra prioritetindən ayrı, tapıntının kalibrasiya olunmuş prioritetləridir.

| ID | Prioritet | Başlıq | Təsdiq | Əlaqəli test |
|---|---|---|---|---|
| BUG-001 | P1 | İmtahan geri sayımı donur və deadline-da avtomatik göndəriş baş vermir | BROWSER_E2E + mənbə | BE-005 retest; BE-011; FE-055 |
| BUG-002 | P1 | Publish paketi lokal məxfi konfiqurasiya faylını ehtiva edir | ARTIFACT_CONFIRMED + mənbə | REL-CFG-01 |
| BUG-003 | P2 | Access token sessionStorage-də saxlanır | BROWSER_E2E + mənbə | BE-002; FE-035 |
| BUG-004 | P2 | Təsdiqsiz hesab üçün məktubu yenidən göndər düyməsi görünmür | BROWSER_E2E + API mesajı + mənbə | BE-003; FE-022 |
| BUG-005 | P2 | Qorunan administrator öz profil sahələrini dəyişə bilir | API_RUNTIME + read-back + mənbə | EXT-001 |
| BUG-006 | P3 | Login modalı Escape ilə bağlandıqda fokus açan düyməyə qayıtmır | BROWSER_E2E | BE-007 retest; FE-105 |

## BUG-001 — İmtahan geri sayımı donur və deadline-da avtomatik göndəriş baş vermir

**Prioritet və təsir:** P1. İştirakçı qalan vaxtı səhv görür və yoxlanmış deadline ssenarisində client avtomatik submit göndərmir; sual ekranı aktiv qalır. Server deadline qorumasının yan keçilməsi və ya yanlış scoring iddia edilmir. Əl ilə göndərmə işləyib: BE-006 retest-də 4 sualdan 2 düzgün cavab üçün **50% PASS** alınıb.

**Feature/endpoint:** `ExamSession → ExamPlayer`; POST `/api/exam-sessions/join`, PUT `/api/exam-sessions/attempts/{id}/answer`, POST `/api/exam-sessions/attempts/{id}/submit`. **Alias:** yaradan `VIPB`, iştirakçı `UserB`. **Mühit/run/commit:** yuxarıdakı Chrome production-build / Development API konteksti.

**Önşərt:** VIPB-nin 15 dəqiqəlik, 4 sintetik suallı sessiyası var; UserB həmin koda qoşula bilir. BE-004 retest bu önşərti UI və HTTP 200 ilə təsdiqləyib. Deadline üçün əlavə BE-011 ayrıca **API fixture-i ilə yaradılmış 1 dəqiqəlik, 1 suallı sessiyanı** istifadə edir; UI-da 1 dəqiqə seçimi olduğu iddia edilmir.

**Təkrar addımları:**

1. VIPB ilə UI-dan 15 dəqiqəlik, 4 suallı sessiya yaradın və kodu götürün.
2. Ayrı brauzer kontekstində UserB ilə daxil olub koda qoşulun.
3. Heç bir cavab seçmədən taymeri təxminən 8 saniyə izləyin; hər təxminən 1.1 saniyədə mətnini qeyd edin.
4. Sonda istəyə görə 4 cavabı seçib əl ilə bitirin; bu addım timer qüsurunu scoring qüsurundan ayırır.
5. Deadline variantında izolə API fixture-i ilə 1 dəqiqəlik sessiya yaradın, UserB ilə UI-dan qoşulun və heç bir müdaxilə etmədən 65 saniyə izləyin; submit request sayını və nəticə ekranına keçidi yoxlayın.

**Gözlənilən:** qalan vaxt keçən real vaxta uyğun monoton azalır; deadline çatanda göndəriş nəticə ekranına keçir. **Faktiki:** `exam-timer-samples.json`-da 8 ölçmənin hamısı `15:00` göstərir. İlk və son ölçmə arasında **7.793 saniyə** var. Əlavə BE-011-in 65 saniyəlik müşahidəsi sonunda `submitRequests=0`, `timerVisible=true`; saxlanmış 13 ölçmənin hamısı `01:00` göstərir. Deadline keçəndə avtomatik nəticə ekranına keçid baş verməyib.

**Təkrarlanma:** iki ayrı sessiya: 15 dəqiqəlik sessiyada 8/8, 1 dəqiqəlik sessiyada 13/13 sabit taymer ölçməsi; ikinci sessiyada deadline keçməsi də yoxlanıb. İlkin BE-005 BLOCKED sətri retest ilə əvəz olunur, ayrıca qüsur sayılmır.

**Sübut və korrelyasiya:** [browser-retest-results.json](evidence/browser-retest-results.json) BE-005, `2026-09-17T09:38:03.429Z`; [exam-timer-samples.json](evidence/exam-timer-samples.json), [exam-frozen-timer.png](evidence/exam-frozen-timer.png). [browser-retest-network.json](evidence/browser-retest-network.json): VIPB create 200 `09:38:03.337Z`, UserB join 200 `09:38:04.866Z`; ölçmələr `09:38:04.902–09:38:12.695Z`. Sonradan 4 answer 200 və manual submit 200 `09:38:14.560Z`; [exam-ui-result.png](evidence/exam-ui-result.png) 50% göstərir. [browser-retest-console.json](evidence/browser-retest-console.json) boşdur; JS exception olmaması məntiqi timer xətasını təkzib etmir. Server TraceId bu sübutlarda saxlanmayıb; korrelyasiya alias, endpoint və UTC vaxtına əsaslanır.

**Deadline sübutu:** [browser-deadline-results.json](evidence/browser-deadline-results.json) BE-011 FAIL, ssenari başlanğıcı `09:41:55.137Z`; [deadline-observation.json](evidence/deadline-observation.json) ölçmələri `09:41:56.979–09:42:57.109Z` aralığını əhatə edir və yekun submit sayını saxlayır; [expired-exam-still-active.png](evidence/expired-exam-still-active.png) bir suallı aktiv ekran və `01:00` taymerini göstərir. JSON-dakı ölçmə aralığı təxminən 60.13 saniyədir, ümumi observation dövrü test nəticəsində 65 saniyədir; bu iki müddət qarışdırılmır.

**Kök səbəb — təsdiqlənmiş kod yolu:** `kiberaz-ui/src/components/ExamSession.tsx:198–209` effekti dependency array-siz hər renderdə qurur. `:199` köhnə `attempt.serverNow` ilə yeni `Date.now()` arasındakı offset-i yenidən hesablayır; `:202` state yenilənməsi render verir, `:206–207` interval və dərhal tick yenidən qurulur. Beləliklə eyni server snapshot-ına əsaslanan tam qalan müddət təkrar göstərilir. `:203` auto-submit yalnız hesablanmış qiymət sıfır olanda çağırılır.

**Düzəliş istiqaməti:** server vaxtı ilə lokal monoton vaxt arasındakı başlanğıc əlaqəsini sabit saxlayın; yalnız yeni server snapshot-ı gəldikdə yeniləyin. Effekt asılılıqlarını və submit-in tək icrasını məqsədli qurun. **Regressiya:** deterministik clock ilə 10 saniyə monotoniya, cavab gələndə vaxtın artmaması, background tab/resume, deadline auto-submit, uğursuz submit retry və manual 50% scoring. **Etibar:** timer failure, yoxlanmış deadline-da avtomatik submit-in yoxluğu və kod səbəbi yüksək; serverin deadline-dan sonra cavab qəbul etməsi iddia edilmir.

## BUG-002 — Publish paketində lokal məxfi konfiqurasiya var

**Prioritet və təsir:** P1, release artefaktı sərhədində qüsur. Lokal konfiqurasiya build cihazından paylaşılacaq/deploy ediləcək paketə daşınır; Production provider zəncirində də yüklənə bilir. İctimai HTTP sızması, secret-lərin etibarlı olması, account takeover və ya faktiki xarici paylaşılma sübut olunmayıb.

**Feature/endpoint:** .NET Release publish, startup configuration; HTTP endpoint deyil. **Alias:** tətbiq hesabı tələb olunmur, release operatoru. **Mühit/run/commit:** həmin run-ın `%TEMP%/20260917T-predeploy-132107/publish` çıxışı və yuxarıdakı commit.

**Önşərt:** developer checkout-unda gitignored `Kiberaz.Api/appsettings.Local.json` var və həmin checkout-dan standart publish hazırlanır.

**Təkrar addımları:**

1. Mövcud audit publish çıxışında yalnız fayl adlarını və ölçülərini yoxlayın; fayl dəyərlərini terminala çıxarmayın.
2. `appsettings.Local.json`-un paketdə olduğunu qeyd edin.
3. Mənbə local fayl ilə paket faylının hash bərabərliyini yalnız boolean nəticə kimi müqayisə edin; hash və secret dəyərlərini yaymayın.
4. `Program.cs` konfiqurasiya sırasını və `.csproj` publish exclusion qaydalarını yoxlayın.

**Gözlənilən:** local secret JSON release paketinə daxil edilmir; Production secret-ləri təyin olunmuş env/secret-store-dan gəlir. **Faktiki:** `appsettings.Local.json` paketdə **1332 bayt**dır və mənbə faylla SHA-256 müqayisəsi **true** verib. `JwtSettings:SecretKey`, Google ClientSecret, SMTP password və CAPTCHA secret kimi açarların boş olmadığı qeyd olunub; dəyərlər yoxlanılmır/açıqlanmır.

**Təkrarlanma:** bir faktiki publish artefaktında müstəqil metadata/hash-bərabərlik baxışı; yeni publish bu hesabatın hazırlanmasında icra edilməyib. **Sübut:** [RELEASE-CONFIG-REVIEW.md](RELEASE-CONFIG-REVIEW.md) REL-CFG-01; [backend-publish.txt](evidence/backend-publish.txt) `EXIT=0`. Compile uğuru təhlükəsiz paket tərkibi ilə eyni deyil. HTTP/TraceId korrelyasiyası tətbiq edilmir.

**Kök səbəb — təsdiqlənmiş:** `Kiberaz.Api/Kiberaz.Api.csproj:1–37` Web SDK istifadə edir və local JSON üçün publish exclusion yoxdur; artefakt bunu təsdiqləyir. `Kiberaz.Api/Program.cs:36–39` local JSON-u bütün mühitlərdə əlavə edir, sonra env/CLI əlavə olunur. Konkret açar env/CLI ilə verilməyibsə local faylın production JSON-dan üstün gəlməsi mümkündür. Fayl `wwwroot` xaricindədir; `UseStaticFiles`-ın onu ictimai etdiyi nəticəsi çıxarılmır.

**Düzəliş istiqaməti:** local secret JSON-u publish-dən çıxarın, Production-da local provider yüklənməsini bağlayın və paket tərkibi assertion-u əlavə edin. **Regressiya:** lokal fayl var/yox ssenarilərində clean publish; secret JSON-un yoxluğu; yalnız env-dən konfiqurasiya; fail-fast qoruyucularının saxlanması. Əvvəlki paketlərin etibarsız tərəfə ötürülməsi ayrıca təsdiqlənərsə müvafiq secret rotasiyası ayrıca planlanmalıdır. **Etibar:** artefaktın daxil edilməsi və configuration yolu yüksək; public exposure iddiası yoxdur.

## BUG-003 — Access token sessionStorage-də saxlanır

**Prioritet və təsir:** P2. `AGENTS.md` və `SENIOR-RULES.md` access token üçün “yaddaşda, localStorage/sessionStorage xaricində” invariantını pozur. Tab daxilində reload-a davam edən, JavaScript-lə oxuna bilən storage yaranır. Audit əlavə XSS, token oğurlanması və ya refresh token sızması aşkar etdiyini iddia etmir.

**Feature/endpoint:** login/session storage; POST `/api/auth/login`, refresh sonrası eyni storage helper-i. **Alias:** UserA. **Mühit/run/commit:** ümumi Chrome production-build / izolə Development API.

**Önşərt:** təsdiqli sintetik UserA; təmiz brauzer konteksti. **Təkrar addımları:**

1. UI-dan UserA ilə daxil olun.
2. Token məzmununu oxumadan yalnız `access_token` açarının sessionStorage/localStorage-də olub-olmadığını boolean kimi yoxlayın.
3. Reload edin və sessiyanın/storage açarının davranışını müşahidə edin.

**Gözlənilən:** `sessionAccessTokenPresent=false`, `localAccessTokenPresent=false`; yeni səhifə sessiyanı HttpOnly refresh cookie ilə bərpa edir. **Faktiki:** [token-storage-presence.json](evidence/token-storage-presence.json) `sessionAccessTokenPresent=true`, `localAccessTokenPresent=false`.

**Təkrarlanma:** BE-002-də bir uğurlu login və storage/reload sınağı; kod helper-i hər uğurlu login üçün bu yazını edir. **Sübut/korrelyasiya:** [browser-results.json](evidence/browser-results.json) BE-002, `09:34:32.585Z`; [browser-network.json](evidence/browser-network.json) UserA login 200 `09:34:33.040Z`; [student-login-reload.png](evidence/student-login-reload.png). Token dəyəri və auth header bu sənədə daxil edilməyib. Test sətirinin vaxtı ssenari başlanğıcıdır, HTTP vaxtından əvvəl olması gözləniləndir.

**Kök səbəb — təsdiqlənmiş:** `kiberaz-ui/src/services/authService.ts:161–162` sessionStorage-dən oxuyur, `:215–216` ora yazır; logout/refresh helper-ləri də eyni açardan istifadə edir (`:226,242,263`). **Düzəliş istiqaməti:** access tokeni modul/yaddaş state-inə keçirin, HttpOnly refresh cookie-ni saxlayın, köhnə storage açarlarını təmizləyin. **Regressiya:** login, Google exchange, reload/new tab, paralel 401 refresh, logout və storage-presence assertions; test logunda token heç vaxt yazılmamalıdır. **Etibar:** yüksək; memory-only qayda pozuntusu birbaşa təsdiqlənib.

## BUG-004 — Təsdiqsiz hesabın resend düyməsi görünmür

**Prioritet və təsir:** P2. Düzgün parolu olan, hələ email təsdiqləməyən istifadəçi aydın xəta mesajı görür, lakin nəzərdə tutulan təsdiq məktubunu yenidən göndər UI addımına çata bilmir. Bu nəticə SMTP çatdırılması uğursuzluğunu göstərmir; resend endpoint ümumiyyətlə UI-dan çağırılmır.

**Feature/endpoint:** LoginModal, POST `/api/auth/login`; çatılmayan CTA POST `/api/auth/resend-confirmation`. **Alias:** Unconfirmed. **Mühit/run/commit:** ümumi browser konteksti. **Önşərt:** test zamanı email təsdiqsiz sintetik hesab və düzgün parol; sonrakı confirmation testindən əvvəlki vəziyyət.

**Təkrar addımları:**

1. Anonim səhifədə “Daxil ol” pəncərəsini açın.
2. Unconfirmed hesabın düzgün email/parolunu daxil edib göndərin.
3. Təsdiq tələb edən mesajın altında resend düyməsini axtarın.

**Gözlənilən:** təsdiq tələb edən mesaj və məktubu yenidən göndərmək üçün işlək CTA. **Faktiki:** “Hesabınız hələ təsdiqlənməyib. E-poçtunuza göndərilən təsdiq linkinə daxil olun.” görünür; resend CTA yoxdur. Screenshot auditdə həssas input dəyərləri çıxarıldıqdan sonrakı görünüşdür; login precondition-u network/result sübutları ilə təsdiqlənir.

**Təkrarlanma:** BE-003-də bir düzgün-parol cəhdi; string şərti həmin server mesajı üçün deterministik false-dur. **Sübut/korrelyasiya:** [browser-results.json](evidence/browser-results.json) BE-003 `09:34:34.741Z`; [unconfirmed-message.txt](evidence/unconfirmed-message.txt), [unconfirmed-resend.png](evidence/unconfirmed-resend.png); [browser-network.json](evidence/browser-network.json) Unconfirmed login 401 `09:34:35.318Z`. HTTP 401 bu hesab vəziyyəti üçün gözləniləndir; qüsur CTA-nın olmamasıdır.

**Kök səbəb — təsdiqlənmiş:** `kiberaz-ui/src/components/auth/LoginModal.tsx:38` resend-i `loginError.toLowerCase().includes('aktiv')` ilə açır, `:117–125` düyməni bu bayrağa bağlayır. `Kiberaz.Infrastructure/Services/AuthService.cs:185–190` mesajında “aktiv” yoxdur. **Düzəliş istiqaməti:** sərbəst mətnə bağlı şərti sabit maşın-oxunan nəticə kodu və ya təhlükəsiz həmişə-əlçatan resend axını ilə əvəz edin; istifadəçi mövcudluğu barədə serverin ümumi cavab siyasətini saxlayın. **Regressiya:** düzgün/yanlış parollu təsdiqsiz, bloklu, kilidli və mövcud olmayan hesab; resend uğur/429; mətn dəyişməsi CTA-nı sındırmır. **Etibar:** yüksək.

## BUG-005 — Qorunan administrator öz profilini dəyişə bilir

**Prioritet və təsir:** P2. Layihənin “owner hesabını heç kim, özü də daxil, redaktə edə bilməz” invariantı adi profil endpoint-ində tətbiq edilmir. Təsdiqlənən sərhəd artıq autentifikasiya olunmuş qorunan adminin öz ad/soyad sahələridir. Başqa hesabın redaktəsi, Admin rolunun verilməsi/ötürülməsi və autentifikasiyasız giriş iddia edilmir.

**Feature/endpoint:** GET/PUT `/api/User/profile`; server claim-indən alınan öz istifadəçi ID-si. **Alias:** AdminA — yalnız izolə bazadakı qorunan-owner test hesabı. **Mühit/run/commit:** API_RUNTIME, izolə Development `localhost:5259`; ümumi run/commit.

**Önşərt:** sintetik bazada qorunan sahibi təmsil edən AdminA ilə autentifikasiya. **Təkrar addımları:**

1. AdminA ilə GET `/api/User/profile` göndərib əvvəlki sahələri yadda saxlayın.
2. Eyni hesabdan PUT `/api/User/profile` göndərin: sintetik `firstName="QA Dəyişmiş"`, `lastName="Sahib"`, mövcud nickname və gender=1.
3. Yenidən GET edin və ad/soyadı müqayisə edin. Bu yoxlama real bazada edilməməlidir.

**Gözlənilən:** server qaydaya uyğun 400/403 ilə rədd edir; profil dəyişmir. **Faktiki:** PUT **200**, `success=true`, “Profil uğurla yeniləndi.”; sonrakı GET dəyişmiş adı/soyadı qaytarır. Read-back qüsuru yalnız cavabın kosmetik uğuru kimi deyil, saxlanmış vəziyyət kimi təsdiqləyir.

**Təkrarlanma:** bir tam GET→PUT→GET icrası, üçü də 200. **Sübut/korrelyasiya:** [api-results.json](evidence/api-results.json) EXT-001: `Owner immutable profile expected; PUT status=200, firstName changed=True`, `2026-09-17T13:37:25.479810+04:00`; [api-requests.json](evidence/api-requests.json) AdminA profil GET `13:37:25.570819`, PUT `13:37:25.671791`, read-back GET `13:37:25.755468` (+04:00). EXT-001 `RequestRange=[113,116]` harness-in **sıfırdan başlayan, sonu daxil olmayan** slice sərhədidir; 1-dən başlayan sıra kimi oxunmamalıdır. Audit helper-i `tools/PreDeployQa/audit-extended.py:9–13` ön/son müqayisəni göstərir.

**Kök səbəb — təsdiqlənmiş:** `Kiberaz.Api/Controllers/UserController.cs:73–79` claim ID-si ilə `UpdateProfileAsync` çağırır. `Kiberaz.Infrastructure/Services/UserService.cs:53–82` owner guard etmədən nickname/ad/soyad/cinsi dəyişir və `UpdateAsync` ilə saxlayır. Eyni servisin email-change yolunda `:93–94` `_protected.IsOwner(user)` rəddi var. `Kiberaz.Infrastructure/Identity/LiteDbUserStore.cs:82–83` yazını PersistAsync-ə ötürür; bu profil qaydasını xidmət əvəzinə tətbiq etmir. [PROD-STARTUP-RESULTS.md](PROD-STARTUP-RESULTS.md) ayrıca statik trace-i ehtiva edir; runtime təsdiqi EXT-001-dən gəlir.

**Düzəliş istiqaməti:** ilk dəyişiklikdən, o cümlədən `SetUserNameAsync`-dən əvvəl eyni `ProtectedAccountPolicy` owner guard-ını tətbiq edin. **Regressiya:** qorunan admin üçün bütün profil sahələri rədd və read-back dəyişməz; adi User/Teacher/VIP profili icazəli; email/role/block owner qadağaları qorunur. **Etibar:** yüksək, source-to-persistence və read-back birlikdə təsdiqləyir.

## BUG-006 — Escape-dən sonra fokus BODY-də qalır

**Prioritet və təsir:** P3. Klaviatura istifadəçisi giriş modalını bağlayanda əvvəlki naviqasiya yerini itirir; növbəti Tab səhifənin gözlənilməyən yerindən davam edə bilər. Funksional login/backend səhvi deyil.

**Feature/endpoint:** Navbar “Daxil ol” trigger-i, `ui/Modal`, LoginModal; mutation endpoint yoxdur. **Alias:** Guest. **Mühit/run/commit:** ümumi Chrome production frontend build. **Önşərt:** anonim səhifə, açan düymə fokuslana bilir.

**Təkrar addımları:**

1. “Daxil ol” düyməsi ilə login modalını açın.
2. Tab ilə modal daxilində hərəkət edin və fokusun dialog daxilində qalmasını yoxlayın.
3. Escape basın.
4. `document.activeElement` üçün yalnız tag/id-ni qeyd edin.

**Gözlənilən:** modal bağlanır, fokus onu açan `#navbar-login-btn` düyməsinə qayıdır. **Faktiki:** modal bağlandıqdan sonra aktiv element `BODY`, id boşdur. **Təkrarlanma:** ilkin BE-007 və retest BE-007 hər ikisində fokus bərpası fail; retest konkret BODY sübutunu saxlayır.

**Sübut/korrelyasiya:** [browser-results.json](evidence/browser-results.json) BE-007 `09:34:45.791Z`; [browser-retest-results.json](evidence/browser-retest-results.json) BE-007 `09:38:14.645Z`; [modal-focus-after-close.json](evidence/modal-focus-after-close.json) `{"tag":"BODY","id":""}`. [browser-retest-console.json](evidence/browser-retest-console.json) boşdur. Fokus əməliyyatı üçün server request/TraceId tələb olunmur.

**Kök səbəb — ehtimal edilən, yüksək inamlı:** `kiberaz-ui/src/components/auth/LoginModal.tsx:97` input `autoFocus` alır. `kiberaz-ui/src/components/ui/Modal.tsx:43–45` əvvəlki elementi `useEffect` mərhələsində götürür; bu vaxt React commit autoFocus-u artıq modal input-una keçirmiş ola bilər. `:79` cleanup həmin artıq unmount edilən input-a fokus qaytarmağa cəhd edə bilər. Müşahidə edilən BODY nəticəsi təsdiqlənib, lakin `previouslyFocused` dəyişəninin konkret runtime referansı instrumentasiya edilmədiyindən kök səbəb tam runtime təsdiqi kimi təqdim edilmir.

**Düzəliş istiqaməti:** açan elementin referansını açılış hadisəsində saxlayın və modal bağlananda hələ sənədə bağlı, görünən trigger-ə qaytarın; autoFocus ilə effect ardıcıllığına güvənməyin. **Regressiya:** mouse/keyboard ilə açılış, Tab/Shift+Tab, Escape/X, auth modal switch, nested confirm və unmount olan trigger üçün fallback. **Etibar:** fokus qüsuru yüksək; dəqiq səbəb yüksək inamlı ehtimal.

## Qüsur kimi hesablanmayan ilkin sınaq uğursuzluqları

- **HTTP 201 gözləntisi:** ilkin API course ssenarisində harness 201 gözləyib, real müqavilə 200 verib. Düzəldilmiş son sınaq nəticəsi əsas götürülür; 200 təkbaşına tətbiq qüsuru deyil.
- **Çatışmayan test webroot:** ilkin foto-upload yoxlamasının izolə host önşərti çatışmırdı; hazırlıq bərpa olunduqdan sonra API-013-R PASS. Bu qeyd production upload qüsuru kimi açılmır.
- **Confirmation token/fixture təkrar istifadəsi:** artıq təsdiqlənmiş hesab üçün idempotent 200 cavabı yeni imtiyaz vermir. İlkin “hər təkrar token 400 olmalıdır” fərziyyəsi tətbiq müqaviləsi deyildi; corrected EXT-003-R/EXT-004-R ayrı saxlanır.
- **Səhv browser selector/duration fərziyyəsi:** ilkin BE-004 1 dəqiqəlik UI/selector timeout-u yaratdı və BE-005/006 bloklandı. Real 15 dəqiqəlik UI seçimi ilə BE-004/006 retest PASS; yalnız BE-005 timer qüsuru qalıb.
- Placeholder hüquqi linklər, ödənişin “tezliklə” olması və digər tamamlanmamış tələblər [FRONTEND-INVENTORY.md](FRONTEND-INVENTORY.md)-də **SPEC_GAP** kimi saxlanır; burada əlavə təsdiqlənmiş bug sayılmır.

Bu sənədin hazırlanmasında yalnız mövcud redaktə edilmiş sübutlar və mənbə oxunub; secret faylları açılmayıb, əlavə tətbiq mutation-u edilməyib. Fix və fix-verification bu auditin əhatəsində deyil.
