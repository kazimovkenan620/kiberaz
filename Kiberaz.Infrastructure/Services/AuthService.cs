using Microsoft.AspNetCore.Identity;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Common;
using Microsoft.Extensions.Hosting;
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
    private static readonly TimeSpan PasswordResetAttemptLockout = TimeSpan.FromMinutes(15);
    private const int MaxPasswordResetFailedAttempts = 5;

    private readonly UserManager<AppUser>    _userManager;
    private readonly SignInManager<AppUser>  _signInManager;
    private readonly TokenService            _tokenService;
    private readonly IEmailService           _emailService;
    private readonly IHostEnvironment        _environment;
    private readonly LiteDbContext           _db;
    private readonly ICaptchaService         _captcha;
    private readonly IAttemptTracker         _attempts;
    private readonly IHttpContextAccessor    _http;

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
        IHttpContextAccessor   http)
    {
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

        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser is not null)
        {
            if (!existingUser.EmailConfirmed)
                await TrySendConfirmationEmailAsync(existingUser);
            // Həm confirmed, həm unconfirmed halda eyni cavab — account existence sızmır
            return ApiResponse<AuthResponse>.Ok(null, genericSuccess);
        }

        var existingNickname = await _userManager.FindByNameAsync(request.Nickname);
        if (existingNickname is not null)
            return ApiResponse<AuthResponse>.Fail("Bu ləqəb artıq başqası tərəfindən istifadə olunur.");

        // Cəhd yalnız həqiqi yeni qeydiyyat sorğuları üçün sayılır.
        // Mövcud e-poçtla edilən sorğular sayğacı artırmır — IP-ni CAPTCHA ilə bloklaya bilməz (DoS).
        _attempts.Record(key);

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
            var errors = result.Errors.Select(e => e.Description).ToList();
            return ApiResponse<AuthResponse>.Fail(errors);
        }

        await _userManager.AddToRoleAsync(user, request.Role);

        // JWT vermirik — hesab hələ e-poçtla təsdiqlənməyib
        var emailResult = await TrySendConfirmationEmailAsync(user, ignoreCooldown: true);
        if (!emailResult.Success)
            return ApiResponse<AuthResponse>.Fail("Qeydiyyat yaradıldı, amma təsdiq e-poçtu göndərilə bilmədi. Bir az sonra yenidən göndərməyi yoxlayın.");

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

        if (!user.EmailConfirmed)
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
        var accessToken  = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        // Refresh token verilənlər bazasına açıq deyil, hash edilmiş formada saxlanılır.
        // Beləliklə, DB sızdırılsa belə, tokeni birbaşa istifadə etmək mümkün olmayacaq.
        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        var response = BuildAuthResponse(user, roles, accessToken, refreshToken);

        return ApiResponse<AuthResponse>.Ok(response, "Giriş uğurludur.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<bool>> LogoutAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiryTime = null;
            await _userManager.UpdateAsync(user);

            // Refresh tokeni silmək kifayət etmir — əlindəki access token hələ 15 dəqiqə işləyir.
            // SecurityStamp yenilənəndə OnTokenValidated həmin tokeni dərhal rədd edir, yəni çıxış REAL çıxışdır.
            await _userManager.UpdateSecurityStampAsync(user);
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

        var email = principal.FindFirstValue(ClaimTypes.Email) ?? principal.FindFirstValue("email");
        if (string.IsNullOrEmpty(email))
            return ApiResponse<AuthResponse>.Fail("Etibarsız token.");

        var user = await _userManager.FindByEmailAsync(email);

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

        if (user == null || !tokensMatch || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
        {
            return ApiResponse<AuthResponse>.Fail("Etibarsız client sorğusu.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var newAccessToken = _tokenService.GenerateAccessToken(user, roles);
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        // Token hər yeniləmədə dəyişdirilir (rotation) — oğurlanmış köhnə token bir dəfə istifadə edildikdən sonra etibarsız olur.
        user.RefreshToken = HashToken(newRefreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

        var response = BuildAuthResponse(user, roles, newAccessToken, newRefreshToken);

        return ApiResponse<AuthResponse>.Ok(response, "Token uğurla yeniləndi.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<string>> CreateGoogleLoginCodeAsync(string email, string firstName, string lastName)
    {
        var user = await _userManager.FindByEmailAsync(email);
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

            await _userManager.AddToRoleAsync(user, AppRoles.User);
        }
        else if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);
        }

        var code = _tokenService.GenerateRefreshToken();
        user.GoogleLoginCodeHash = HashToken(code);
        user.GoogleLoginCodeExpiryTime = DateTime.UtcNow.Add(GoogleLoginCodeLifetime);
        await _userManager.UpdateAsync(user);

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
        var expired = user is null || user.GoogleLoginCodeExpiryTime <= DateTime.UtcNow;
        if (user is not null)
        {
            user.GoogleLoginCodeHash = null;
            user.GoogleLoginCodeExpiryTime = null;
            await _userManager.UpdateAsync(user);
        }

        // `user is null` şərti `expired`-in içində onsuz da var — burada təkrarlanır ki,
        // kompilyatorun null-flow analizi aşağıdakı sətirlərdə user-i non-null saya bilsin.
        if (expired || user is null)
            return ApiResponse<AuthResponse>.Fail("Google giriş kodu etibarsızdır və ya vaxtı bitib.");

        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = HashToken(refreshToken);
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _userManager.UpdateAsync(user);

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
        if (user is null || user.EmailConfirmed)
            return ApiResponse<bool>.Ok(true, genericMessage);

        await TrySendConfirmationEmailAsync(user);

        // Email göndərməsi uğursuz olsa belə generic mesaj qaytarılır — əks halda
        // xəta mesajı mövcud hesabın olduğunu aşkar edir (account enumeration).
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

        var now = DateTime.UtcNow;
        if (user.PasswordResetLockoutEnd is not null && user.PasswordResetLockoutEnd > now)
            return ApiResponse<bool>.Fail("Çox sayda uğursuz cəhd edildi. Bir az sonra yenidən yoxlayın.");

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            user.PasswordResetFailedAttempts++;
            if (user.PasswordResetFailedAttempts >= MaxPasswordResetFailedAttempts)
            {
                user.PasswordResetFailedAttempts = 0;
                user.PasswordResetLockoutEnd = now.Add(PasswordResetAttemptLockout);
            }

            await _userManager.UpdateAsync(user);
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
