using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Kiberaz.Domain.Entities;

namespace Kiberaz.Infrastructure.Services;

// JWT access token və refresh token yaradan servis.
// İstifadəçinin kimlik məlumatları (claims) token içinə şifrələnir, backend hər sorğuda bunu yoxlayır.
public class TokenService
{
    /// <summary>JWT içində SecurityStamp-i daşıyan claim adı.</summary>
    public const string SecurityStampClaimType = "sstamp";

    // Refresh axınında qəbul edilən "vaxtı bitmiş" access tokenin maksimum yaşı.
    // Refresh token ömrü ilə eyni saxlanılır — bundan köhnə access token artıq heç bir halda refresh üçün işlədilə bilməz.
    private static readonly TimeSpan MaxExpiredAccessTokenAge = TimeSpan.FromDays(7);

    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    // İstifadəçi üçün qısamüddətli JWT access token yaradır.
    // SecretKey ilə imzalanmış token içinə istifadəçinin id, email, adı və rolları yerləşdirilir — 15 dəqiqə etibarlıdır.
    public string GenerateAccessToken(AppUser user, IList<string> roles)
    {
        var jwtSettings = _config.GetSection("JwtSettings");
        var secretKey   = jwtSettings["SecretKey"]
                          ?? throw new InvalidOperationException("JWT SecretKey tapılmadı.");

        // SecretKey-dən HMAC-SHA256 alqoritmi ilə imzalama açarı hazırlanır.
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // Claims — token içindəki məlumat sahələridir; backend bu sahələrə əsasən istifadəçini tanıyır.
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("firstName", user.FirstName),
            new("lastName",  user.LastName),
        };

        // SecurityStamp token-in içinə yazılır. Parol/e-poçt dəyişdikdə Identity bu damğanı yeniləyir,
        // OnTokenValidated hadisəsi isə hər sorğuda bazadakı damğa ilə müqayisə edir —
        // uyğunsuzluq halında köhnə access token dərhal (15 dəqiqə gözləmədən) etibarsız sayılır.
        if (!string.IsNullOrEmpty(user.SecurityStamp))
            claims.Add(new Claim(SecurityStampClaimType, user.SecurityStamp));

        // Hər rol ayrı bir Claim kimi əlavə edilir — çoxlu rol dəstəklənir.
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = new JwtSecurityToken(
            issuer:             jwtSettings["Issuer"],
            audience:           jwtSettings["Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Uzunmüddətli, kriptoqrafik refresh token yaradır.
    // 64 bayt kriptoqrafik təsadüfi data Base64-ə çevrilir — bu token verilənlər bazasında saxlanılır və access token yenilənərkən istifadə olunur.
    public string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    // Vaxtı bitmiş JWT-dən istifadəçi məlumatlarını çıxarır.
    // Refresh token axını üçün lazımdır — token vaxtı keçsə belə imza doğruluğu yoxlanılır, lakin vaxt yoxlanışı atlanır.
    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var jwtSettings = _config.GetSection("JwtSettings");
        var secretKey   = jwtSettings["SecretKey"]
                          ?? throw new InvalidOperationException("JWT SecretKey tapılmadı.");

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ValidateLifetime = false // Refresh üçün vaxtı bitmiş token qəbul edilir
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);

        // Tokenin HMAC-SHA256 ilə imzalandığını yoxlayırıq — başqa alqoritmlə saxtalaşdırma cəhdinə qarşı.
        var jwtSecurityToken = securityToken as JwtSecurityToken;
        if (jwtSecurityToken == null || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Səhv token.");
        }

        // ValidateLifetime=false olduğu üçün burada tokenin nə qədər köhnə olduğunu ÖZÜMÜZ yoxlamalıyıq.
        // Bu yoxlama olmasa aylar əvvəlki access token da refresh axınına buraxılır və
        // oğurlanmış köhnə token cütü ilə sessiya bərpa etmək mümkün olur.
        if (jwtSecurityToken.ValidTo < DateTime.UtcNow.Subtract(MaxExpiredAccessTokenAge))
        {
            throw new SecurityTokenException("Token çox köhnədir.");
        }

        return principal;
    }
}
