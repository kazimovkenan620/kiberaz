using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using Microsoft.AspNetCore.RateLimiting;


namespace Kiberaz.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    // Dependency Injection: bu üç asılılıq konstruktorda qəbul edilir — controller özü onları yaratmır.
    // ASP.NET Core hər sorğuda bu obyektləri avtomatik yaradıb ötürür, biz yalnız interfeys vasitəsilə işləyirik.
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;

    public AuthController(IAuthService authService, IConfiguration configuration, IHostEnvironment environment)
    {
        _authService = authService;
        _configuration = configuration;
        _environment = environment;
    }

    // Refresh token-i httpOnly cookie-yə yazırıq — bu o deməkdir ki, JavaScript kodu bu cookie-yə heç vaxt müraciət edə bilmir.
    // Beləcə XSS hücumu zamanı zərərli skript token-i oğurlaya bilmir; brauzer cookie-ni yalnız HTTP sorğularında avtomatik əlavə edir.
    // Development mühitində Secure=false qoyulur, çünki localhost HTTPS işlətmir.
    private void SetRefreshTokenCookie(string refreshToken)
    {
        Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure   = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddDays(7)
        });
    }

    // Çıxış zamanı cookie-ni serverdan silmək üçün bu metod çağırılır — bu olmadan köhnə cookie brauzerdə qalır.
    // Orijinal cookie ilə eyni atributlar verilməlidir — əks halda bəzi brauzer/proxy birləşmələri silməni qəbul etmir.
    private void ClearAuthCookies()
    {
        Response.Cookies.Delete("refresh_token", new CookieOptions
        {
            HttpOnly = true,
            Secure   = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict
        });
    }

    /// <summary>Yeni istifadəçi qeydiyyatı</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")] 
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status400BadRequest)]
   public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        return result.Success
            ? StatusCode(StatusCodes.Status201Created, result)
            : BadRequest(result);
    }

    /// <summary>E-poçt təsdiqi linki üçün endpoint</summary>
    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail([FromQuery] string userId, [FromQuery] string token)
    {
        var result = await _authService.ConfirmEmailAsync(userId, token);
        var frontendUrl = _configuration["FrontendUrl"]
            ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
            ?? "http://localhost:5173";
        
        if (result.Success)
            return Redirect($"{frontendUrl}/login?confirmed=true");
            
        return Redirect($"{frontendUrl}/login?confirmed=false");
    }

    [HttpPost("confirm-email")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ConfirmEmailPost([FromBody] ConfirmEmailRequest request)
    {
        var result = await _authService.ConfirmEmailAsync(request.UserId, request.Token);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>İstifadəçi girişi — JWT token qaytarır</summary>
    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendConfirmation([FromBody] ResendConfirmationEmailRequest request)
    {
        var result = await _authService.ResendConfirmationEmailAsync(request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var result = await _authService.ForgotPasswordAsync(request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var result = await _authService.ResetPasswordAsync(request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("google")]
    [AllowAnonymous]
    public IActionResult GoogleLogin()
    {
        if (string.IsNullOrWhiteSpace(_configuration["Authentication:Google:ClientId"]))
            return BadRequest(ApiResponse<bool>.Fail("Google OAuth konfiqurasiya edilmeyib."));

        var redirectUrl = Url.Action(nameof(GoogleCallback), "Auth", null, Request.Scheme);
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback()
    {
        // Google autentifikasiyasından qayıdan istifadəçi məlumatları ExternalScheme-də saxlanılıb — buradan oxuyuruq.
        var authenticateResult = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
        if (!authenticateResult.Succeeded || authenticateResult.Principal is null)
            return Redirect(BuildFrontendGoogleRedirect(null, false));

        var email = authenticateResult.Principal.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrWhiteSpace(email))
            return Redirect(BuildFrontendGoogleRedirect(null, false));

        var firstName = authenticateResult.Principal.FindFirstValue(ClaimTypes.GivenName) ?? string.Empty;
        var lastName = authenticateResult.Principal.FindFirstValue(ClaimTypes.Surname) ?? string.Empty;
        // Qısamüddətli bir dəfəlik "code" yaradılır — frontend bunu /google/exchange endpoint-inə göndərərək real JWT alır.
        // Bu iki addımlı axın callback URL-i üzərindən birbaşa token ötürməyin qarşısını alır.
        var result = await _authService.CreateGoogleLoginCodeAsync(email, firstName, lastName);
        await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);

        return Redirect(BuildFrontendGoogleRedirect(result.Data, result.Success));
    }

    [HttpPost("google/exchange")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ExchangeGoogleCode([FromBody] GoogleLoginExchangeRequest request)
    {
        var result = await _authService.ExchangeGoogleLoginCodeAsync(request.Code);
        if (result.Success && result.Data is not null)
        {
            SetRefreshTokenCookie(result.Data.RefreshToken);
            result.Data.RefreshToken = string.Empty;
        }

        return result.Success ? Ok(result) : BadRequest(result);
    }

    private string BuildFrontendGoogleRedirect(string? code, bool success)
    {
        var frontendUrl = _configuration["FrontendUrl"]
            ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
            ?? "http://localhost:5173";
        var callbackUrl = $"{frontendUrl.TrimEnd('/')}/google-login-callback";

        if (!success || string.IsNullOrWhiteSpace(code))
            return $"{callbackUrl}#error=login_failed";

        return $"{callbackUrl}#code={Uri.EscapeDataString(code)}";
    }

   [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (result.Success && result.Data is not null)
        {
            SetRefreshTokenCookie(result.Data.RefreshToken);
            // Refresh token cookie-yə yazıldıqdan sonra body-dən silinir — dual exposure qarşısı.
            // Body-də qalsa logger/proxy/devtools vasitəsilə sıza bilər.
            result.Data.RefreshToken = string.Empty;
        }

        return result.Success
            ? Ok(result)
            : Unauthorized(result);
    }

    /// <summary>Çıxış — token ləğv edilir</summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue("sub")
                     ?? string.Empty;

        var result = await _authService.LogoutAsync(userId);
        ClearAuthCookies();
        return Ok(result);
    }

    /// <summary>Refresh token vasitəsilə yeni token almaq</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RefreshToken([FromBody] TokenRefreshRequest request)
    {
        // Mobil tətbiqlər refresh token-i body-də göndərə bilər, veb brauzer isə onu httpOnly cookie-də saxlayır.
        // Bu yoxlama hər iki ssenarini eyni endpoint-də idarə etməyə imkan verir — arxitekturanı sadə saxlayır.
        if (string.IsNullOrWhiteSpace(request.RefreshToken) &&
            Request.Cookies.TryGetValue("refresh_token", out var cookieToken))
        {
            request.RefreshToken = cookieToken;
        }

        var result = await _authService.RefreshTokenAsync(request);
        if (result.Success && result.Data is not null)
        {
            SetRefreshTokenCookie(result.Data.RefreshToken);
            result.Data.RefreshToken = string.Empty;
        }

        return result.Success
            ? Ok(result)
            : BadRequest(result);
    }

    /// <summary>Cari istifadəçi məlumatı — token lazımdır</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Me()
    {
        // JWT token-in içindəki "claim"-lər oxunur — verilənlər bazasına sorğu göndərilmir.
        // Bu məlumatlar token imzalandığı anda daxil edilib, buna görə hər sorğuda DB yükü olmadan istifadəçini tanımaq mümkündür.
        var userId    = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email     = User.FindFirstValue(ClaimTypes.Email);
        var firstName = User.FindFirstValue("firstName");
        var lastName  = User.FindFirstValue("lastName");

        return Ok(new { userId, email, firstName, lastName });
    }
}
