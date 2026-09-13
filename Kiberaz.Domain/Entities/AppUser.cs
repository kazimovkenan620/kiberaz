using Kiberaz.Domain.Enums;

namespace Kiberaz.Domain.Entities;

// Bu sinif ASP.NET Core Identity-nin standart IdentityUser-ını əvəz edir.
// IdentityUser EF Core-a bağlı olduğu üçün LiteDB ilə işləmir — bütün sahələr burada əl ilə yazılıb,
// LiteDbUserStore isə Identity-nin interface-lərini implement edərək aralarında körpü qurur.
public class AppUser
{
    // GUID formatında unikal identifikator — hər istifadəçi üçün avtomatik yaradılır.
    // String tip seçilib ki, IdentityUser ilə format uyğunluğu qalsın.
    public string Id { get; set; } = Guid.NewGuid().ToString();

    // Identity bu sahəni giriş üçün istifadə edir; bizdə Nickname ilə eyni dəyər yazılır.
    public string? UserName { get; set; }

    // Böyük hərflərə çevrilmiş versiya — axtarış zamanı case-sensitive problem olmadan tapılır.
    public string? NormalizedUserName { get; set; }

    public string? Email { get; set; }

    // Böyük hərflərə çevrilmiş e-poçt — LiteDB indeksi bu sahəyə qurulur.
    public string? NormalizedEmail { get; set; }

    public bool EmailConfirmed { get; set; }

    // Şifrə birbaşa yox, bcrypt hash-i saxlanır — orijinal şifrə heç vaxt bazaya getmir.
    public string? PasswordHash { get; set; }

    // Şifrə və ya e-poçt dəyişdikdə bu dəyər yenilənir ki, köhnə tokenlar artıq etibarsız sayılsın.
    // Bu mexanizm sayəsində parol dəyişdikdən sonra başqa cihazlardakı aktiv sessiyalar bağlanır.
    public string? SecurityStamp { get; set; }

    // Eyni anda iki sorğu eyni sətri dəyişdirsə conflict aşkar etmək üçün istifadə olunur.
    public string? ConcurrencyStamp { get; set; } = Guid.NewGuid().ToString();

    public string? PhoneNumber { get; set; }
    public bool PhoneNumberConfirmed { get; set; }
    public bool TwoFactorEnabled { get; set; }

    // Kilidlənmə bitmə vaxtı null olarsa hesab açıqdır; dəyər varsa o vaxta qədər giriş bağlıdır.
    public DateTimeOffset? LockoutEnd { get; set; }

    public bool LockoutEnabled { get; set; } = true;

    // Ardıcıl uğursuz giriş sayı — Identity müəyyən saydan sonra hesabı müvəqqəti kilidləyir.
    public int AccessFailedCount { get; set; }

    // ─── Platforma sahələri ────────────────────────────────────────────

    public string FirstName { get; set; } = string.Empty;
    public string LastName  { get; set; } = string.Empty;
    public Gender Gender    { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? ProfileImageUrl { get; set; }

    // Saytda görünən unikal ləqəb — e-poçt gizli qalır, yalnız bu ad ictimaiyyətə açıqdır.
    public string Nickname { get; set; } = string.Empty;

    // Refresh token orijinal halda yox, SHA-256 hash-i olaraq saxlanır.
    // Baza sızdıqda oğrulunan hash-lə giriş mümkün olmur — bu token-at-rest qorumasıdır.
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    // E-poçt təsdiq linki son dəfə nə vaxt göndərildiyini saxlayır — spam qarşısı üçün.
    public DateTime? LastConfirmationEmailSentAt { get; set; }
    public DateTime? LastPasswordResetEmailSentAt { get; set; }

    // Şifrə sıfırlama cəhdlərini sayır — çox olduqda müvəqqəti kilidlənir.
    public int      PasswordResetFailedAttempts { get; set; }
    public DateTime? PasswordResetLockoutEnd    { get; set; }

    public DateTime? LastEmailChangeConfirmationSentAt { get; set; }

    // E-poçt dəyişikliyi təsdiqlənənə qədər yeni ünvan burada gözləmə rejimindədir.
    public string? PendingNewEmail { get; set; }

    // Google ilə giriş üçün müvəqqəti kod — hash halında saxlanır, 2 dəqiqə etibarlıdır.
    public string?   GoogleLoginCodeHash       { get; set; }
    public DateTime? GoogleLoginCodeExpiryTime { get; set; }
    public string? GoogleLoginCodeSecurityStamp { get; set; }

    // ─── NoSQL Embedding ────────────────────────────────────────────────

    // Roller ayrı cədvəl olmadan bu sənədin içinə embed edilir.
    // SQL-dəki AspNetUserRoles join cədvəlinin NoSQL versiyasıdır — oxuma zamanı JOIN lazım deyil.
    public List<string>       Roles  { get; set; } = new();

    // Xarici giriş məlumatları (Google, GitHub) — ayrı collection olmadan sənəd daxilindədir.
    public List<AppUserLogin> Logins { get; set; } = new();

    // E-poçt təsdiq, parol sıfırlama kimi müvəqqəti tokenlar burada saxlanır.
    public List<AppUserToken> Tokens { get; set; } = new();

    public List<AppUserClaim> Claims { get; set; } = new();
}

// Xarici giriş məlumatı (Google, GitHub) — AppUser.Logins siyahısında embed edilir.
// LoginProvider hansı xidmətin olduğunu (məsəlun "Google"), ProviderKey isə həmin xidmətdəki unikal id-ni saxlayır.
public class AppUserLogin
{
    public string  LoginProvider       { get; set; } = string.Empty;
    public string  ProviderKey         { get; set; } = string.Empty;
    public string? ProviderDisplayName { get; set; }
}

// E-poçt təsdiqləmə, parol sıfırlama kimi əməliyyatlar üçün müvəqqəti token — AppUser.Tokens içindədir.
public class AppUserToken
{
    public string  LoginProvider { get; set; } = string.Empty;
    public string  Name          { get; set; } = string.Empty;
    public string? Value         { get; set; }
}

// İstifadəçiyə aid əlavə məlumat (claim) — rol sistemi xaricindəki xüsusi icazələr üçün istifadə olunur.
public class AppUserClaim
{
    public string Type  { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
