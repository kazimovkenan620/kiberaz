# Production başlanğıcında CAPTCHA qoruyucuları

**PASS — 3/3 mənfi başlanğıc sınağı.** Release publish çıxışındakı API ayrıca `Production` proseslərində başladıldı. Hər üç proses gözlənilən CAPTCHA konfiqurasiya istisnası ilə özü dayandı; çıxış kodu `-532462766`, timeout yoxdur. Ayrılmış loopback portlarında listener müşahidə edilmədi və `Now listening on` qeydi olmadı.

| Ssenari | Gözlənilən qoruyucu | Nəticə |
| --- | --- | --- |
| CAPTCHA secret boşdur | `CaptchaService.cs:59` | PASS |
| Rəsmi həmişə-keçən test açarı | `CaptchaService.cs:63` | PASS |
| Test olmayan sintetik açar + development bypass true | `CaptchaService.cs:68` | PASS |

Əmr: `pwsh -NoProfile -File tools/PreDeployQa/prod-startup-probes.ps1`.

İcra vaxtı: 2026-09-17 09:36:29–09:36:58 UTC. [Redaktə edilmiş JSON sübutu](evidence/production-startup-probes.json) hər ssenarinin vaxtını, portunu, exit kodunu və gözlənilən diaqnostikasını saxlayır.

Hər ssenari OS temp daxilində auditə aid `production-probes` altında yeni DB, açar və content root qovluğu istifadə etdi. Əsas `runtime/qa.db` açılmadı və konfiqurasiyası dəyişdirilmədi. Mövcud probe qovluğunda təkrar icra rədd edilir. JWT açarı təsadüfi yaradıldı; SMTP loopback port 9, Google parametrləri boşdur. Test scripti HTTP sorğusu göndərmir. Mənbə ardıcıllığında CAPTCHA qoruyucusu (`Kiberaz.Api/Program.cs:637`) sual seed-i (`:644`) və server `Run` çağırışından (`:733`) əvvəldir; bu sınaqlar həmin qoruyucuda bitib. Boş sintetik bazada admin olmadığından yaranan ayrıca critical qeyd secret/e-poçt redaksiyası ilə sübutda saxlanılıb; prosesin dayanma səbəbi CAPTCHA istisnasıdır.

Bu nəticə yalnız yanlış Production CAPTCHA konfiqurasiyasının fail-closed davranışını sübut edir. Düzgün production hosting, TLS/proxy/CORS, real CAPTCHA doğrulaması, şəbəkə paketlərinin tam auditi və SMTP/OAuth inteqrasiyası təsdiqlənmir.

## Qorunan admin profilinə statik baxış

`UserController.cs:73–79` yalnız claim-dən alınan istifadəçi ID-si ilə profil xidmətini çağırır. `UserService.UpdateProfileAsync` (`UserService.cs:53–82`) ad, soyad, cins və nickname dəyişikliklərindən əvvəl `_protected.IsOwner` yoxlaması etmir. `LiteDbUserStore.UpdateAsync` (`LiteDbUserStore.cs:82`) concurrency yoxlamasından sonra sənədi yeniləyir; adminə aid profil qadağası yoxdur. E-poçt dəyişmə yolunda isə ayrıca owner yoxlaması var (`UserService.cs:93`).

Bu, layihənin “owner özü də hesabı redaktə edə bilməz” qaydası ilə statik uyğunsuzluqdur: autentifikasiya olunmuş qorunan administrator öz adi profil sahələrini dəyişə bilən yola çatır. Bu müşahidə admin rolunun ötürülməsi, başqa hesabın redaktəsi və ya autentifikasiyasız giriş kimi qiymətləndirilmir. Bu alt tapşırıqda profilə API yazısı edilmədi; runtime təsdiqi koordinatorun sınağına aiddir. Tövsiyə: profil xidmətində digər qorunan əməliyyatlarla eyni owner yoxlamasını tətbiq etmək və öz profilini yeniləmə regressiya ssenarisini əlavə etmək; audit rejimində düzəliş edilmədi.
