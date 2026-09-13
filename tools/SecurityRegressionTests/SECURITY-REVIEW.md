# Admin girişi və səlahiyyət yoxlaması — 2026-09-07

Layihə: `C:\Users\User\Desktop\kiberaz`. Admin və adi istifadəçi eyni `/api/auth/login` axınına daxil olur. Admin login endpoint-i əlavə edilmədi. Mövcud admin API-ləri serverdə Admin rolu tələb edir; brauzer menyusu, localStorage, sorğu gövdəsi və başlıqlar səlahiyyət mənbəyi deyil.

## Tapıntılar və düzəlişlər

| Səviyyə | Tapıntı / hücum şərti | Fayl | Tətbiq edilmiş düzəliş |
|---|---|---|---|
| Yüksək | Vaxtı bitmiş refresh/Google kodu yerli saatın UTC ilə müqayisəsinə görə qəbul edilirdi; sınaqda təkrarlandı. | `Kiberaz.Infrastructure/Data/LiteDbContext.cs:78` | LiteDB UTC tarix oxuması; saxlanmış tarixlərin formatı dəyişmir. |
| Yüksək | Paralel profil/refresh yazısı köhnə istifadəçi sənədini geri yazaraq rolu və bloklamanı bərpa edə bilərdi. | `Kiberaz.Infrastructure/Identity/LiteDbUserStore.cs:67` | Tranzaksiya daxilində ConcurrencyStamp müqayisəsi; köhnə update/delete rədd edilir. |
| Yüksək | Refresh cari security stamp, bloklanma və təsdiqi yoxlamırdı; paralel rotation yazısının nəticəsi yoxlanmırdı. | `Kiberaz.Infrastructure/Services/AuthService.cs:229` | Dəyişməz user ID, cari stamp/hesab/müddət yoxlaması; token yalnız uğurlu yazıdan sonra verilir. |
| Yüksək | Google girişində hesab yalnız email üzrə əlaqələndirilirdi; bloklanma, kodun cari sessiyaya bağlılığı və paralel istehlakı yoxlanmırdı. | `Kiberaz.Api/Controllers/AuthController.cs`, `Kiberaz.Infrastructure/Services/AuthService.cs:296` | Təsdiqli Google email iddiası, provider ID üzrə əlaqə, yeni əlaqə üçün Google-un idarə etdiyi email; kod stamp və bir dəfəlik CAS ilə qorunur. |
| Orta | İmzalı JWT bazada dəyişmiş rolu, bloklanmanı və boş security stamp-i tam yoxlamırdı. Adi rol dəyişmə axınında stamp yenilənməsi vardı, amma ayrıca dəyişikliklərdə bu yetərli deyildi. | `Kiberaz.Api/Program.cs:138` | Hər sorğuda cari LiteDB rolu, təsdiq, blok və məcburi stamp; uyğunsuzluq 401. |
| Orta | Admin rolu/bloklama bir neçə ayrı yazı ilə dəyişirdi; paralel əməliyyatlar bütövlüyü poza bilərdi. | `Kiberaz.Infrastructure/Services/AdminService.cs:319` | Əməliyyatı edən admin, son aktiv admin və hədəf dəyişiklikləri eyni tranzaksiyada; sessiyalar birlikdə ləğv olunur. |
| Orta | Bootstrap konfiqurasiyası restart zamanı geri alınmış Admin rolunu yenidən verə bilərdi. | `Kiberaz.Infrastructure/Data/DbInitializer.cs:62` | Bootstrap yalnız ilk admin üçün işləyir; yüksəliş sessiya ləğvi ilə birlikdə saxlanır. |
| Orta, konfiqurasiyadan asılı | Yanlış proxy IP siyahısı etibarlı proxy siyahısını boşaldıb saxta forwarded başlıqlara şərait yarada bilərdi. | `Kiberaz.Api/Program.cs:274` | Yanlış konfiqurasiya rədd edilir; proxy siyahısı əvvəlcə doğrulanır. |

Əlavə sərtləşdirmə: server servisində User/Teacher allowlist-i; HS256 və məcburi imza/müddət; production-da qısa və məlum development açarının rəddi; environment/CLI konfiqurasiyasının üstünlüyü; açıq elan edilməyən API üçün məcburi autentifikasiya; admin/auth cavablarında no-store.

## Dəyişən fayllər

- `Kiberaz.Api/Program.cs`: JWT, cari hesab/rol, fallback authorization, Google claims, proxy və konfiqurasiya yoxlamaları.
- `Kiberaz.Api/Controllers/AdminController.cs`: JSON məzmun tipi və no-store.
- `Kiberaz.Api/Controllers/AuthController.cs`: Google email/provider yoxlaması, no-store və logout xətasının düzgün qaytarılması.
- `Kiberaz.Application/Interfaces/IAuthService.cs`: Google servis çağırışında provider ID və email sahiblik statusu.
- `Kiberaz.Domain/Entities/AppUser.cs`: Google kodunun aid olduğu security stamp.
- `Kiberaz.Infrastructure/Data/LiteDbContext.cs`: UTC oxuma və istifadəçi yazıları üçün ortaq kilid.
- `Kiberaz.Infrastructure/Data/DbInitializer.cs`: ilk admin bootstrap və birlikdə sessiya ləğvi.
- `Kiberaz.Infrastructure/Identity/LiteDbUserStore.cs`: istifadəçi update/delete üçün optimistic concurrency.
- `Kiberaz.Infrastructure/Services/AdminService.cs`: admin hesab dəyişikliklərinin atomik icrası və sessiyaların ləğvi.
- `Kiberaz.Infrastructure/Services/AuthService.cs`: giriş, refresh, logout, Google kodu və qeydiyyatın sərtləşdirilməsi.
- `Kiberaz.Infrastructure/Services/TokenService.cs`: imza alqoritmi, müddət və ölçü yoxlamaları.
- `Kiberaz.Infrastructure/Services/UserService.cs`: self-service rol allowlist-i və atomik dəyişiklik.
- `tools/SecurityRegressionTests/Program.cs`: təcrid edilmiş LiteDB və real HTTP pipeline üzərində 267 yoxlama.
- `tools/SecurityRegressionTests/SecurityRegressionTests.csproj`: əlavə NuGet paketi tələb etməyən test icraçısı.
- `tools/SecurityRegressionTests/.gitignore`: test build artefaktlarının istisnası.
- `tools/SecurityRegressionTests/README.md`: təkrar icra əmri və sınaq sərhədləri.
- `tools/SecurityRegressionTests/SECURITY-REVIEW.md`: bu hesabat.

## Yoxlama və əməliyyat təsiri

`dotnet build Kiberaz.sln --no-restore`: 0 xəta, 0 xəbərdarlıq.

`dotnet run --project tools/SecurityRegressionTests/SecurityRegressionTests.csproj --artifacts-path tools/SecurityRegressionTests/.artifacts`: 267/267 keçdi. 15 admin endpoint-i üçün anonim, User, Teacher, Moderator, VIP və saxta rol başlıqları; normal admin girişi; imza/algoritm/issuer/audience/expiry; ləğv edilmiş tokenlər; paralel refresh; profil overposting/başqa istifadəçi ID-si; Google kodu və vaxtı; köhnə sənədin yenidən yazılması yoxlanılıb.

Rol dəyişəndə yenidən giriş tələb olunur. Əvvəldən qalmış security stamp-siz tokenlər və Google kodları qəbul edilmir. İlk Google əlaqələndirməsi üçün təsdiqli Gmail və ya Google Workspace email-i tələb olunur; üçüncü tərəf email-ləri parol girişi istifadə etməlidir. Yeni backend lokalda işə salınıb; bu iş production-a deploy deyil.

Bu, admin/autentifikasiya sərhədinə yönəlmiş kod baxışı və lokal avtomatlaşdırılmış sınaqdır. Canlı Google OAuth provayderi, production reverse proxy/TLS, internet üzərindən penetrasiya testi və bütün layihə auditi aparılmayıb. Yoxlamaların keçməsi bütün mümkün hücumlara zəmanət deyil.

## İstinadlar

Hər sorğuda icazə yoxlaması və default rədd prinsipi: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

LiteDB-nin standart tarix oxuma davranışı və UTC_DATE: [LiteDB Pragmas](https://www.litedb.org/docs/pragmas/).

Google email sahiblik şərtləri: [Google backend authentication](https://developers.google.com/identity/sign-in/android/backend-auth?hl=en).
