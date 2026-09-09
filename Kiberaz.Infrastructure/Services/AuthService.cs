using Microsoft.AspNetCore.Identity;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Common;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using System.Security.Cryptography;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

// Bu servis bütün autentifikasiya əməliyyatlarını idarə edir: qeydiyyat, giriş, token yeniləmə, parol sıfırlama.
// Hər bir ictimai metod brute-force hücumlarına qarşı cəhd izləmə və CAPTCHA mexanizmi ilə qorunur.
public class AuthService : IAuthService
{
    // Timing attack qoruması: istifadəçi tapılmadıqda belə BCrypt işlətmək üçün sabit dummy hash.
    // new AppUser() ilə CheckPasswordAsync çağıranda PasswordHash=null olur, BCrypt işlətmir — cavab vaxtı fərqlənir.
    // Bu hash yalnız bir dəfə hesablanır (static initializer), istifadəçi adresini sızmır.
    private static readonly string _dummyPasswordHash =
        new Microsoft.AspNetCore.Identity.PasswordHasher<Domain.Entities.AppUser>()
            .HashPassword(new Domain.Entities.AppUser(), Guid.NewGuid().ToString());

    private static readonly TimeSpan ConfirmationEmailCooldown = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PasswordResetEmailCooldown = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan GoogleLoginCodeLifetime = TimeSpan.FromMinutes(2);

    private readonly UserManager<AppUser>    _userManager;
    private readonly SignInManager<AppUser>  _signInManager;
    private readonly TokenService            _tokenService;
    private readonly IEmailService           _emailService;
    private readonly IHostEnvironment        _environment;
    private readonly LiteDbContext           _db;
    private readonly ICaptchaService         _captcha;
    private readonly IAttemptTracker         _attempts;
    private readonly IHttpContextAccessor    _http;
    private readonly ILogger<AuthService>    _logger;

    // Konstruktor vasitəsilə bütün lazımi xidmətlər inyeksiya edilir ki, servis öz asılılıqlarını özü yaratmasın.
    // Bu "Dependency Injection" prinsipidir — testlərdə mock obyektlər ötürmək mümkün olur.
    public AuthService(
        UserManager<AppUser>   userManager,
        SignInManager<AppUser> signInManager,
        TokenService           tokenService,
        IEmailService          emailService,
        IHostEnvironment       environment,
        LiteDbContext          db,
        ICaptchaService        captcha,
        IAttemptTracker        attempts,
        IHttpContextAccessor   http,
        ILogger<AuthService>   logger)
    {
        _logger        = logger;
        _userManager   = userManager;
        _signInManager = signInManager;
        _tokenService  = tokenService;
        _emailService  = emailService;
        _environment   = environment;
        _db            = db;
        _captcha       = captcha;
        _attempts      = attempts;
        _http          = http;
    }

    private string ClientIp()
        => _http.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    /// <inheritdoc />
    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        if (request.Role != AppRoles.User && request.Role != AppRoles.Teacher)
            return ApiResponse<AuthResponse>.Fail("Yalnız istifadəçi və ya müəllim rolu seçilə bilər.");
        var ip = ClientIp();
        var key = $"register:{ip}";

        if (_attempts.RequiresCaptcha(key))
        {
            if (string.IsNullOrWhiteSpace(request.CaptchaToken))
                return ApiResponse<AuthResponse>.Fail("Çox sayda cəhd edildi. Zəhmət olmasa CAPTCHA-nı tamamlayın.", captchaRequired: true);

            if (!await _captcha.VerifyAsync(request.CaptchaToken, ip))
                return ApiResponse<AuthResponse>.Fail("CAPTCHA doğrulanmadı. Yenidən cəhd edin.", captchaRequired: true);
        }

        // Eyni mesaj hər üç halda qaytarılır — e-poçt enumeration (OWASP A07) qarşısı.
        // Hücumçu 201 vs 400 fərqindən istifadəçi mövcudluğunu aşkar edə bilməməlidir.
        const string genericSuccess = "Qeydiyyat uğurla tamamlandı. Zəhmət olmasa e-poçtunuza gələn linklə hesabınızı təsdiqləyin.";

        // Nickname availability is public. Resolve it independently of the email,
        // otherwise a taken nickname becomes an oracle for arbitrary email addresses.
        _attempts.Record(key);
        var existingNickname = await _userManager.FindByNameAsync(request.Nickname);
        if (existingNickname is not null)
            return ApiResponse<AuthResponse>.Fail("Bu ləqəb artıq başqası tərəfindən istifadə olunur.");

        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
        {
            if (!existingUser.EmailConfirmed)
                await TrySendConfirmationEmailAsync(existingUser);
            // Həm confirmed, həm unconfirmed halda eyni cavab — account existence sızmır
            return ApiResponse<AuthResponse>.Ok(null, genericSuccess);
        }

        var user = new AppUser
        {
            UserName  = request.Nickname,
            Email     = request.Email,
            FirstName = request.FirstName,
            LastName  = request.LastName,
            Gender    = request.Gender,
            Nickname  = request.Nickname,
            EmailConfirmed = false,
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code is "DuplicateEmail" or "DuplicateUserName"))
                return ApiResponse<AuthResponse>.Ok(null, genericSuccess);
            var errors = result.Errors.Select(e => e.Description).ToList();
            return ApiResponse<AuthResponse>.Fail(errors);
        }

        var roleResult = await _userManager.AddToRoleAsync(user, request.Role);
        if (!roleResult.Succeeded)
            return ApiResponse<AuthResponse>.Fail("Hesab rolu saxlanmadı. Yenidən cəhd edin.");

        // JWT vermirik — hesab hələ e-poçtla təsdiqlənməyib
        var emailResult = await TrySendConfirmationEmailAsync(user, ignoreCooldown: true);
        if (!emailResult.Success)
            _logger.LogWarning("Registration confirmation delivery failed; the account can request a resend.");

        _attempts.Reset(key);
        return ApiResponse<AuthResponse>.Ok(null, genericSuccess);
    }

    /// <inheritdoc />
    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest request)
    {
        var ip    = ClientIp();
        var emailKey = $"login:{request.Email.ToLowerInvariant()}";
        var ipKey    = $"login:ip:{ip}";

        // İki qat qoruma: həm e-poçt-bazalı (eyni hesaba hücum), həm IP-bazalı (credential stuffing).
        // Hücumçu N fərqli e-poçt sınasa, ipKey sayğacı artır və CAPTCHA tətbiq olunur.
        if (_attempts.RequiresCaptcha(emailKey) || _attempts.RequiresCaptcha(ipKey))
        {
            if (string.IsNullOrWhiteSpace(request.CaptchaToken))
                return ApiResponse<AuthResponse>.Fail("Çox sayda uğursuz giriş cəhdi. Zəhmət olmasa CAPTCHA-nı tamamlayın.", captchaRequired: true);

            if (!await _captcha.VerifyAsync(request.CaptchaToken, ip))
                return ApiResponse<AuthResponse>.Fail("CAPTCHA doğrulanmadı. Yenidən cəhd edin.", captchaRequired: true);
        }

        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            // Timing attack önlənməsi: istifadəçi tapılmasa da real BCrypt işlədilir.
            // new AppUser() ilə CheckPasswordAsync çağıranda PasswordHash=null olur, BCrypt atlanır —
            // cavab vaxtı fərqindən e-poçt mövcudluğu aşkar edilə bilər.
            _userManager.PasswordHasher.VerifyHashedPassword(new AppUser(), _dummyPasswordHash, request.Password);
            _attempts.Record(emailKey);
            _attempts.Record(ipKey);
            return ApiResponse<AuthResponse>.Fail("E-poçt və ya parol yanlışdır.",
                captchaRequired: _attempts.RequiresCaptcha(emailKey) || _attempts.RequiresCaptcha(ipKey));
        }

        if (!user.EmailConfirmed || user.LockoutEnd > DateTimeOffset.UtcNow)
        {
            // Təsdiqlənməmiş hesaba qarşı brute-force: cəhd sayılır
            _attempts.Record(emailKey);
            _attempts.Record(ipKey);
            return ApiResponse<AuthResponse>.Fail("Hesabınız aktiv deyil. Zəhmət olmasa e-poçtunuza göndərilən təsdiq linkinə daxil olun.");
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            _attempts.Record(emailKey);
            _attempts.Record(ipKey);
            return ApiResponse<AuthResponse>.Fail("E-poçt və ya parol yanlışdır.",
                captchaRequired: _attempts.RequiresCaptcha(emailKey) || _attempts.RequiresCaptcha(ipKey));
        }

        _attempts.Reset(emailKey);
        // ipKey sıfırlanmır — IP-dən uğurlu giriş credential stuffing hücumunu bitirmir

        var roles        = await _userManager.GetRolesAsync(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        // Refresh token verilənlər bazasına açıq deyil, hash edilmiş formada saxlanılır.
        // Beləliklə, DB sızdırılsa belə, tokeni birbaşa istifadə etmək mümkün olmayacaq.
        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        if (string.IsNullOrWhiteSpace(user.SecurityStamp))
            user.SecurityStamp = Guid.NewGuid().ToString();
        if (!(await _userManager.UpdateAsync(user)).Succeeded)
            return ApiResponse<AuthResponse>.Fail("Hesab dəyişib. Yenidən daxil olun.");

        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var response = BuildAuthResponse(user, roles, accessToken, refreshToken);

        return ApiResponse<AuthResponse>.Ok(response, "Giriş uğurludur.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<bool>> LogoutAsync(string userId)
    {
        // Retry fresh reads on a concurrent refresh; never report a logout that did not persist.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user is null) break;
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            user.GoogleLoginCodeHash = null;
            user.GoogleLoginCodeExpiryTime = null;
            user.SecurityStamp = Guid.NewGuid().ToString();
            if ((await _userManager.UpdateAsync(user)).Succeeded) break;
            if (attempt == 2) return ApiResponse<bool>.Fail("Çıxış tamamlanmadı. Yenidən cəhd edin.");
        }

        await _signInManager.SignOutAsync();
        return ApiResponse<bool>.Ok(true, "Çıxış uğurludur.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<AuthResponse>> RefreshTokenAsync(TokenRefreshRequest request)
    {
        string accessToken = request.AccessToken;
        string refreshToken = request.RefreshToken ?? string.Empty;

        // Algorithm confusion cəhdini try-catch ilə tut
        ClaimsPrincipal? principal;
        try
        {
            principal = _tokenService.GetPrincipalFromExpiredToken(accessToken);
        }
        catch
        {
            return ApiResponse<AuthResponse>.Fail("Etibarsız token.");
        }

        if (principal == null)
            return ApiResponse<AuthResponse>.Fail("Etibarsız token.");

        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
            return ApiResponse<AuthResponse>.Fail("Etibarsız token.");

        var user = await _userManager.FindByIdAsync(userId);

        // Constant-time müqayisə — timing attack qarşısı.
        // Adi == operatoru ilk fərqli baytda dayanır; sabit vaxt müqayisəsi isə tokenin uzunluğundan asılı olmayaraq eyni vaxt aparır.
        //
        // Hər iki tərəf SHA-256-dan bir dəfə də keçirilir: nəticə HƏMİŞƏ 32 baytdır.
        // Əvvəlki PadRight(128) yanaşması hash uzunluğu dəyişsə səssizcə sınardı —
        // FixedTimeEquals fərqli uzunluqda sadəcə false qaytarır və müqayisə mənasını itirirdi.
        var storedToken   = user?.RefreshToken ?? string.Empty;
        var providedToken = HashToken(refreshToken ?? string.Empty);
        var tokensMatch = CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(storedToken)),
            SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(providedToken)));

        // Boş storedToken (logout edilmiş hesab) real hash-ə heç vaxt bərabər ola bilməz,
        // amma niyyəti açıq saxlamaq üçün açıq şəkildə rədd edilir.
        if (string.IsNullOrEmpty(storedToken))
            tokensMatch = false;

        var stamp = principal.FindFirstValue(TokenService.SecurityStampClaimType);
        var stampMatches = user is not null && !string.IsNullOrWhiteSpace(user.SecurityStamp) &&
                           string.Equals(user.SecurityStamp, stamp, StringComparison.Ordinal);

        // ── TOKEN TƏKRAR İSTİFADƏSİNİN AŞKARLANMASI ──────────────────────
        //
        // Rotation köhnə tokeni etibarsız edir, amma bu, oğurluğu DAYANDIRMIR:
        // hücumçu tokeni oğurlayıb istifadə edirsə, qurbanın köhnə tokeni sadəcə rədd olunurdu,
        // hücumçunun yeni tokeni isə işləməyə davam edirdi.
        //
        // Bu vəziyyət tanınandır: imza etibarlıdır, SecurityStamp uyğundur (yəni token bu hesaba
        // aiddir və yaxın vaxta qədər etibarlı idi), amma təqdim edilən refresh token bazadakı ilə
        // üst-üstə düşmür — yəni artıq bir dəfə istifadə olunub və rotasiya edilib.
        // Belə halda sessiya OĞURLANMIŞ sayılır: SecurityStamp yenilənir və saxlanılan refresh token
        // silinir. Nəticədə HƏM hücumçunun, HƏM qurbanın sessiyası dərhal ölür və hesab sahibi
        // yenidən parolla daxil olmağa məcbur olur.
        //
        // Yan təsir: eyni anda iki lövhə (tab) refresh etsə, ikincisi bu yolla çıxarıla bilər.
        // Bu, oğurlanmış sessiyanın açıq qalmasından daha ucuz seçimdir.
        if (user is not null && stampMatches && !tokensMatch && !string.IsNullOrEmpty(user.RefreshToken))
        {
            user.SecurityStamp = Guid.NewGuid().ToString();
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            user.GoogleLoginCodeHash = null;
            user.GoogleLoginCodeExpiryTime = null;
            await _userManager.UpdateAsync(user);

            return ApiResponse<AuthResponse>.Fail("Sessiya təhlükəsizlik səbəbi ilə bağlandı. Yenidən daxil olun.");
        }

        if (user == null || !tokensMatch || user.RefreshTokenExpiryTime is null ||
            user.RefreshTokenExpiryTime <= DateTime.UtcNow || !user.EmailConfirmed ||
            user.LockoutEnd > DateTimeOffset.UtcNow || !stampMatches)
        {
            return ApiResponse<AuthResponse>.Fail("Etibarsız client sorğusu.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        // Token hər yeniləmədə dəyişdirilir (rotation) — oğurlanmış köhnə token bir dəfə istifadə edildikdən sonra etibarsız olur.
        user.RefreshToken = HashToken(newRefreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        if (!(await _userManager.UpdateAsync(user)).Succeeded)
            return ApiResponse<AuthResponse>.Fail("Sessiya dəyişib. Yenidən daxil olun.");

        var newAccessToken = _tokenService.GenerateAccessToken(user, roles);
        var response = BuildAuthResponse(user, roles, newAccessToken, newRefreshToken);

        return ApiResponse<AuthResponse>.Ok(response, "Token uğurla yeniləndi.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<string>> CreateGoogleLoginCodeAsync(string providerId, string email, bool authoritativeEmail, string firstName, string lastName)
    {
        if (string.IsNullOrWhiteSpace(providerId) || string.IsNullOrWhiteSpace(email))
            return ApiResponse<string>.Fail("Google girişi mümkün olmadı.");
        var user = await _userManager.FindByLoginAsync("Google", providerId);
        if (user is null)
        {
            // Only Google-managed email ownership can establish a new account link.
            if (!authoritativeEmail) return ApiResponse<string>.Fail("Bu hesab üçün e-poçt və parolla daxil olun.");
            user = await _userManager.FindByEmailAsync(email);
            if (user is not null && (!user.EmailConfirmed || user.Logins.Any(l => l.LoginProvider == "Google")))
                return ApiResponse<string>.Fail("Bu hesab üçün e-poçt və parolla daxil olun.");
        }
        if (user?.LockoutEnd > DateTimeOffset.UtcNow)
            return ApiResponse<string>.Fail("Google girişi mümkün olmadı.");
        if (user is null)
        {
            var nickname = await GenerateUniqueNicknameAsync(email);
            user = new AppUser
            {
                UserName = nickname,
                Email = email,
                FirstName = string.IsNullOrWhiteSpace(firstName) ? "Google" : firstName.Trim(),
                LastName = string.IsNullOrWhiteSpace(lastName) ? "User" : lastName.Trim(),
                Gender = Kiberaz.Domain.Enums.Gender.Male,
                Nickname = nickname,
                EmailConfirmed = true
            };

            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return ApiResponse<string>.Fail(createResult.Errors.Select(e => e.Description).ToList());

            if (!(await _userManager.AddToRoleAsync(user, AppRoles.User)).Succeeded)
                return ApiResponse<string>.Fail("Google girişi mümkün olmadı.");
        }
        else if (!user.EmailConfirmed)
        {
            return ApiResponse<string>.Fail("Əvvəlcə hesabın e-poçtunu təsdiqləyin.");
        }

        if (!user.Logins.Any(l => l.LoginProvider == "Google" && l.ProviderKey == providerId))
            user.Logins.Add(new AppUserLogin { LoginProvider = "Google", ProviderKey = providerId, ProviderDisplayName = "Google" });

        var code = _tokenService.GenerateRefreshToken();
        if (string.IsNullOrWhiteSpace(user.SecurityStamp))
            user.SecurityStamp = Guid.NewGuid().ToString();
        user.GoogleLoginCodeHash = HashToken(code);
        user.GoogleLoginCodeExpiryTime = DateTime.UtcNow.Add(GoogleLoginCodeLifetime);
        user.GoogleLoginCodeSecurityStamp = user.SecurityStamp;
        if (!(await _userManager.UpdateAsync(user)).Succeeded)
            return ApiResponse<string>.Fail("Google girişi mümkün olmadı.");

        return ApiResponse<string>.Ok(code, "Google giriş kodu yaradıldı.");
    }

    public async Task<ApiResponse<AuthResponse>> ExchangeGoogleLoginCodeAsync(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return ApiResponse<AuthResponse>.Fail("Google giriş kodu etibarsızdır.");

        var codeHash = HashToken(code);
        var user = _db.Users.FindOne(u => u.GoogleLoginCodeHash == codeHash);

        // Kod həmişə tüketilir — hətta vaxtı bitibsə belə.
        // Əks halda süresi keçmiş kod DB-də qalır və timing hücumu ilə yenidən sınana bilər.
        var expired = user is null || user.GoogleLoginCodeExpiryTime is null ||
            user.GoogleLoginCodeExpiryTime <= DateTime.UtcNow || !user.EmailConfirmed ||
            user.LockoutEnd > DateTimeOffset.UtcNow || string.IsNullOrWhiteSpace(user.SecurityStamp) ||
            !string.Equals(user.SecurityStamp, user.GoogleLoginCodeSecurityStamp, StringComparison.Ordinal);
        if (user is not null)
        {
            user.GoogleLoginCodeHash = null;
            user.GoogleLoginCodeExpiryTime = null;
            user.GoogleLoginCodeSecurityStamp = null;
            if (!(await _userManager.UpdateAsync(user)).Succeeded)
                return ApiResponse<AuthResponse>.Fail("Google giriş kodu etibarsızdır və ya vaxtı bitib.");
        }

        // `user is null` şərti `expired`-in içində onsuz da var — burada təkrarlanır ki,
        // kompilyatorun null-flow analizi aşağıdakı sətirlərdə user-i non-null saya bilsin.
        if (expired || user is null)
            return ApiResponse<AuthResponse>.Fail("Google giriş kodu etibarsızdır və ya vaxtı bitib.");

        var roles = await _userManager.GetRolesAsync(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        if (!(await _userManager.UpdateAsync(user)).Succeeded)
            return ApiResponse<AuthResponse>.Fail("Hesab dəyişib. Yenidən daxil olun.");

        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        return ApiResponse<AuthResponse>.Ok(
            BuildAuthResponse(user, roles, accessToken, refreshToken),
            "Google ilə giriş uğurludur.");
    }

    private async Task<string> GenerateUniqueNicknameAsync(string email)
    {
        var baseName = new string(email.Split('@')[0]
            .Where(char.IsLetterOrDigit)
            .Take(12)
            .ToArray());

        if (baseName.Length < 3)
            baseName = $"user{RandomNumberGenerator.GetInt32(1000, 9999)}";

        var nickname = baseName;
        var suffix = 0;
        while (await _userManager.FindByNameAsync(nickname) is not null)
        {
            suffix++;
            var tail = suffix.ToString();
            nickname = $"{baseName[..Math.Min(baseName.Length, 16 - tail.Length)]}{tail}";
        }

        return nickname;
    }

    /// <inheritdoc />
    public async Task<ApiResponse<bool>> ResendConfirmationEmailAsync(ResendConfirmationEmailRequest request)
    {
        var genericMessage = "Təsdiq linki e-poçtunuza göndərildi.";
        var user = await _userManager.FindByEmailAsync(request.Email);

        // CAVAB hər halda eynidir (account enumeration qorunması), LAKİN server tərəfdə
        // hansı yolun getdiyi loglanır. Əvvəl bu üç tamamilə fərqli nəticə —
        // "hesab yoxdur", "artıq təsdiqlidir", "cooldown aktivdir" — heç bir iz qoymurdu,
        // ona görə "göndərildi yazır amma e-poçt gəlmir" şikayətini diaqnoz etmək mümkün deyildi.
        if (user is null)
        {
            _logger.LogInformation("Resend: hesab tapılmadı — e-poçt göndərilmədi.");
            return ApiResponse<bool>.Ok(true, genericMessage);
        }

        if (user.EmailConfirmed)
        {
            _logger.LogInformation("Resend: hesab artıq təsdiqlidir ({UserId}) — e-poçt göndərilmədi.", user.Id);
            return ApiResponse<bool>.Ok(true, genericMessage);
        }

        var now = DateTime.UtcNow;
        if (user.LastConfirmationEmailSentAt is not null &&
            now - user.LastConfirmationEmailSentAt.Value < ConfirmationEmailCooldown)
        {
            var qalan = (int)(ConfirmationEmailCooldown - (now - user.LastConfirmationEmailSentAt.Value)).TotalSeconds;
            _logger.LogWarning(
                "Resend: 60 saniyəlik cooldown aktivdir ({UserId}) — e-poçt GÖNDƏRİLMƏDİ. Qalan: {Qalan} san.",
                user.Id, qalan);
            return ApiResponse<bool>.Ok(true, genericMessage);
        }

        var sendResult = await TrySendConfirmationEmailAsync(user);

        if (!sendResult.Success)
        {
            // SMTP xətasının detalı EmailService-də loglanır; burada yalnız nəticə qeyd edilir.
            _logger.LogError("Resend: e-poçt göndərilə bilmədi ({UserId}). SMTP loglarına bax.", user.Id);
        }
        else
        {
            _logger.LogInformation("Resend: təsdiq e-poçtu göndərildi ({UserId}).", user.Id);
        }

        // Cavab hər halda generic qalır — uğursuzluq hesabın mövcudluğunu aşkar etməməlidir.
        return ApiResponse<bool>.Ok(true, genericMessage);
    }

    /// <inheritdoc />
    public async Task<ApiResponse<bool>> ConfirmEmailAsync(string userId, string token)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        var result = await _userManager.ConfirmEmailAsync(user, token);
        if (result.Succeeded)
            return ApiResponse<bool>.Ok(true, "Hesabınız uğurla təsdiqləndi! İndi daxil ola bilərsiniz.");

        // İDEMPOTENTLİK — eyni təsdiq linki iki dəfə işləndikdə.
        //
        // Identity-nin təsdiq tokeni SecurityStamp-ə bağlıdır: ilk uğurlu təsdiq stamp-i
        // yeniləyir və HƏMİN token dərhal etibarsız olur. Link ikinci dəfə açıldıqda
        // (poçt filtrinin link prefetch-i, səhifə yeniləməsi, ikiqat klik) token rədd olunur.
        //
        // Əvvəl bu hal "Təsdiq linki etibarsızdır və ya vaxtı bitib" kimi göstərilirdi —
        // hesab TƏSDİQLƏNMİŞ olduğu halda istifadəçi əməliyyatın uğursuz olduğunu düşünürdü.
        // Hesab artıq təsdiqlidirsə nəticə istənilən haldadır, ona görə uğur qaytarılır.
        //
        // Qeyd: bu, "filan hesab təsdiqlidirmi?" sualına cavab verir. Yeni sızma deyil —
        // giriş axını onsuz da təsdiqlənməmiş hesab üçün ayrıca mesaj qaytarır və orada
        // yalnız e-poçt lazımdır, burada isə hesabın ID-si bilinməlidir.
        var latest = await _userManager.FindByIdAsync(userId);
        if (latest is not null && latest.EmailConfirmed)
            return ApiResponse<bool>.Ok(true, "Hesabınız artıq təsdiqlənib. İndi daxil ola bilərsiniz.");

        return ApiResponse<bool>.Fail("Təsdiq linki etibarsızdır və ya vaxtı bitib.");
    }
    public async Task<ApiResponse<bool>> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var ip  = ClientIp();
        // Açar e-poçtla qurulur ki, eyni hesaba qarşı parol sıfırlama spam cəhdlərini izləyək.
        var key = $"forgot:{request.Email.Trim().ToLowerInvariant()}";

        // Hədd aşıldıqda CAPTCHA tələb edilir; bu, avtomatlaşdırılmış sıfırlama skriptlərini əngəlləyir.
        if (_attempts.RequiresCaptcha(key))
        {
            if (string.IsNullOrWhiteSpace(request.CaptchaToken))
                return ApiResponse<bool>.Fail("Çox sayda cəhd edildi. Zəhmət olmasa CAPTCHA-nı tamamlayın.", captchaRequired: true);

            if (!await _captcha.VerifyAsync(request.CaptchaToken, ip))
                return ApiResponse<bool>.Fail("CAPTCHA doğrulanmadı. Yenidən cəhd edin.", captchaRequired: true);
        }

        _attempts.Record(key);

        // Ümumi mesaj işlədilir — belə olmazsa haker hesabın mövcud olub-olmadığını anlaya bilər.
        var genericMessage = "Şifrə yeniləmə linki e-poçtunuza göndərildi.";
        var email = request.Email.Trim();
        if (string.IsNullOrWhiteSpace(email))
            return ApiResponse<bool>.Fail("E-poçt daxil edin.");

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null || !user.EmailConfirmed)
            return ApiResponse<bool>.Ok(true, genericMessage);

        await TrySendPasswordResetEmailAsync(user);
        return ApiResponse<bool>.Ok(true, genericMessage);
    }

    public async Task<ApiResponse<bool>> ResetPasswordAsync(ResetPasswordRequest request)
    {
        if (request.NewPassword != request.ConfirmPassword)
            return ApiResponse<bool>.Fail("Şifrələr uyğun deyil.");

        if (request.NewPassword.Length < 8 || !request.NewPassword.Any(char.IsUpper) || !request.NewPassword.Any(char.IsDigit))
            return ApiResponse<bool>.Fail("Şifrə minimum 8 simvoldan, 1 böyük hərfdən və 1 rəqəmdən ibarət olmalıdır.");

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user is null || !user.EmailConfirmed)
            return ApiResponse<bool>.Fail("Şifrə yeniləmə linki etibarsızdır.");

        // The endpoint limits the requester. An invalid bearer token must never
        // write victim state or disable a valid recovery token, including legacy locks.
        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            return ApiResponse<bool>.Fail("Şifrə yeniləmə linki etibarsızdır və ya vaxtı bitib.");
        }

        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        user.PasswordResetFailedAttempts = 0;
        user.PasswordResetLockoutEnd = null;
        await _userManager.UpdateAsync(user);
        await _signInManager.SignOutAsync();

        return ApiResponse<bool>.Ok(true, "Şifrə uğurla yeniləndi.");
    }

    // Bu köməkçi metod e-poçt göndərməzdən əvvəl cooldown müddətini yoxlayır ki, istifadəçini spam etməyək.
    // ignoreCooldown = true yalnız ilk qeydiyyatda istifadə edilir, çünki o zaman heç bir əvvəlki göndərme yoxdur.
    private async Task<ApiResponse<bool>> TrySendConfirmationEmailAsync(AppUser user, bool ignoreCooldown = false)
    {
        var now = DateTime.UtcNow;
        if (!ignoreCooldown &&
            user.LastConfirmationEmailSentAt is not null &&
            now - user.LastConfirmationEmailSentAt.Value < ConfirmationEmailCooldown)
        {
            return ApiResponse<bool>.Ok(true, "Təsdiq linki artıq göndərilib. 60 saniyə sonra yenidən yoxlayın.");
        }

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var emailResult = await _emailService.SendConfirmationEmailAsync(user.Email!, user.Id, token);
        if (!emailResult.Success)
            return emailResult;

        // Uğurlu göndərişin zamanı yadda saxlanılır ki, növbəti cəhddə cooldown hesablansın.
        user.LastConfirmationEmailSentAt = now;
        await _userManager.UpdateAsync(user);
        return emailResult;
    }

    // Bu köməkçi metod parol sıfırlama e-poçtu üçün eyni cooldown məntiqini tətbiq edir.
    // 60 saniyəlik fasilə həm serveri yükdən qoruyur, həm də e-poçt spamının qarşısını alır.
    private async Task<ApiResponse<bool>> TrySendPasswordResetEmailAsync(AppUser user, bool ignoreCooldown = false)
    {
        var now = DateTime.UtcNow;
        if (!ignoreCooldown &&
            user.LastPasswordResetEmailSentAt is not null &&
            now - user.LastPasswordResetEmailSentAt.Value < PasswordResetEmailCooldown)
        {
            return ApiResponse<bool>.Ok(true, "Şifrə yeniləmə linki artıq göndərilib. 60 saniyə sonra yenidən yoxlayın.");
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var emailResult = await _emailService.SendPasswordResetEmailAsync(user.Email!, user.Id, token);
        if (!emailResult.Success)
            return emailResult;

        user.LastPasswordResetEmailSentAt = now;
        await _userManager.UpdateAsync(user);
        return emailResult;
    }

    private static AuthResponse BuildAuthResponse(AppUser user, IList<string> roles, string accessToken, string refreshToken)
        => new()
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt    = DateTime.UtcNow.AddMinutes(15),
            User = new UserInfo
            {
                Id              = user.Id,
                Nickname        = user.Nickname,
                FirstName       = user.FirstName,
                LastName        = user.LastName,
                Gender          = (int)user.Gender,
                JoinDate        = user.CreatedAt,
                Roles           = roles.ToList(),
                ProfileImageUrl = user.ProfileImageUrl
            }
        };

    // Token açıq mətn kimi saxlanılmır — SHA-256 hash-i DB-yə yazılır.
    // Beləliklə, verilənlər bazası sızdırılsa belə, orijinal tokeni bərpa etmək mümkün deyil.
    private static string HashToken(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
