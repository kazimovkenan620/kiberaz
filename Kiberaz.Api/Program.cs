using System.Text;
using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Kiberaz.Application.Interfaces;
using Kiberaz.Application.Validators;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Common;
using Kiberaz.Infrastructure.Data;
using Kiberaz.Infrastructure.Identity;
using Kiberaz.Infrastructure.Services;
using Kiberaz.Api.Middleware;
using Kiberaz.Api.Filters;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;




// Isolated PDF worker exits before loading configuration, secrets, Identity or LiteDB.
if (args is ["--sanitize-pdf"])
{
    await PdfProcessSanitizer.RunWorkerAsync();
    return;
}

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
// Deployment secrets and explicit command-line settings take precedence over local files.
builder.Configuration.AddEnvironmentVariables().AddCommandLine(args);

// ─── 1. LİTEDB ────────────────────────────────────────────────
// AddSingleton: tətbiq boyunca yalnız bir LiteDbContext obyekti yaradılır — bütün sorğular eyni instansı paylaşır.
// LiteDB fayl əsaslı bir verilənlər bazasıdır və eyni fayla paralel birdən çox bağlantı açmaq xəta verir, buna görə Singleton seçilir.
builder.Services.AddSingleton<LiteDbContext>();

// ─── 2. ASP.NET CORE IDENTITY (LiteDB Custom Stores ilə) ─────
// ASP.NET Core Identity istifadəçi/rol idarəsini standartlaşdırır — biz yalnız ona öz LiteDB mağazalarımızı veririk.
// Belə ki, Identity-nin daxili SQL Server/EF Core mağazası əvəzinə LiteDbUserStore və LiteDbRoleStore işləyir.
builder.Services.AddIdentity<AppUser, AppRole>(options =>
{
    options.Password.RequiredLength         = 8;
    options.Password.RequireUppercase       = true;
    options.Password.RequireDigit           = true;
    options.Password.RequireNonAlphanumeric = false;

    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(5);
    options.Lockout.AllowedForNewUsers      = true;

    options.User.RequireUniqueEmail = true;

    options.SignIn.RequireConfirmedEmail = true;
})
.AddUserStore<LiteDbUserStore>()   // ← LiteDB User Store
.AddRoleStore<LiteDbRoleStore>()   // ← LiteDB Role Store
.AddDefaultTokenProviders()
.AddErrorDescriber<AzIdentityErrorDescriber>();

// E-poçt təsdiqi və şifrə sıfırlama üçün yaradılan tokenlərin ömrü 2 saat olaraq məhdudlaşdırılır.
// Default ömür 1 gündür — bu qısaldılmış limit istifadəçini keçmiş linkə klikləməkdən qoruyur.
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
{
    options.TokenLifespan = TimeSpan.FromHours(2);
});

// ─── 3. JWT AUTHENTICATION ────────────────────────────────────
// JWT token-inin etibarlılığını yoxlamaq üçün lazım olan parametrlər burada təyin edilir.
// SecretKey konfiqurasiyada olmasa tətbiq start-da bilavasitə qəzaya uğrayır — bu gizli açarın unudulmasının qarşısını alır.
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey   = jwtSettings["SecretKey"]
                  ?? throw new InvalidOperationException("JWT SecretKey konfiqurasiyada tapılmadı!");
if (Encoding.UTF8.GetByteCount(secretKey) < 32 ||
    (!builder.Environment.IsDevelopment() && secretKey.StartsWith("SuperSecretKeyForDevelopment", StringComparison.Ordinal)))
    throw new InvalidOperationException("JWT üçün ən azı 32 baytlıq məxfi, təsadüfi açar konfiqurasiya edin.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        RequireSignedTokens      = true,
        RequireExpirationTime    = true,
        ValidAlgorithms          = [SecurityAlgorithms.HmacSha256],
        ValidIssuer              = jwtSettings["Issuer"],
        ValidAudience            = jwtSettings["Audience"],
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        // ClockSkew sıfırlanır: default olaraq ASP.NET Core tokenin vaxtı keçsə belə 5 dəqiqəlik güzəşt edir.
        // Bunu sıfırlamaq token-in dəqiq müddəti qurtardıqda etibarsız sayılmasını təmin edir.
        ClockSkew                = TimeSpan.Zero
    };

    // ─── SECURITY STAMP YOXLAMASI ─────────────────────────────
    // İmza düzgün olsa belə token-in HƏLƏ DƏ etibarlı olduğunu yoxlayırıq.
    // Identity parol və e-poçt dəyişdikdə (biz isə əlavə olaraq rol dəyişikliyində) SecurityStamp-i yeniləyir;
    // token-in içindəki damğa bazadakı ilə uyğun gəlmirsə, token dərhal rədd edilir.
    // Bu olmadan parol dəyişdirildikdən sonra oğurlanmış access token 15 dəqiqə daha işləyirdi.
    // Rədd 401 qaytarır — frontend-dəki apiClient bunu görüb avtomatik refresh edir və yeni claim-lərlə davam edir.
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var principal = context.Principal;
            if (principal is null)
            {
                context.Fail("Token etibarsızdır.");
                return;
            }

            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? principal.FindFirstValue("sub");

            if (string.IsNullOrEmpty(userId))
            {
                context.Fail("Token etibarsızdır.");
                return;
            }

            var userManager = context.HttpContext.RequestServices
                .GetRequiredService<UserManager<AppUser>>();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null || !user.EmailConfirmed || user.LockoutEnd > DateTimeOffset.UtcNow)
            {
                // İstifadəçi silinib, amma token hələ ömrünü başa vurmayıb.
                context.Fail("Token etibarsızdır.");
                return;
            }

            var storedStamp = user.SecurityStamp;

            var tokenStamp = principal.FindFirstValue(TokenService.SecurityStampClaimType);
            if (string.IsNullOrWhiteSpace(storedStamp) || string.IsNullOrWhiteSpace(tokenStamp) ||
                !string.Equals(storedStamp, tokenStamp, StringComparison.Ordinal))
            {
                context.Fail("Sessiya etibarsızdır. Yenidən daxil olun.");
                return;
            }

            // A valid signature does not grant a role that was removed from the account.
            var liveRoles = new HashSet<string>(await userManager.GetRolesAsync(user), StringComparer.Ordinal);
            var tokenRoles = principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToHashSet(StringComparer.Ordinal);
            if (!liveRoles.SetEquals(tokenRoles))
            {
                context.Fail("Hesabın səlahiyyətləri dəyişib. Yenidən daxil olun.");
                return;
            }

            // Admin claim-i yalnız kodda sabitlənmiş sistem hesabı üçün etibarlıdır.
            // LiteDB əl ilə dəyişdirilsə və ya köhnə Admin tokeni qalsa belə sorğu keçmir.
            var protectedAccount = context.HttpContext.RequestServices
                .GetRequiredService<ProtectedAccountPolicy>();
            var isOwner = protectedAccount.IsOwner(user);
            if ((liveRoles.Contains(AppRoles.Admin) && !isOwner) ||
                (isOwner && !liveRoles.SetEquals([AppRoles.Admin])))
                context.Fail("Admin hesabının bütövlüyü pozulub.");
        }
    };
});

// ─── 3a. COOKIE OPTIONS ───────────────────────────────────────
// Qlobal cookie parametrləri: HttpOnly=true JavaScript-in cookie-yə çatmasını, SameSite=Strict CSRF hücumlarını bloklayır.
// Bu parametrlər SetRefreshTokenCookie metodundakı seçimlərlə uyğun olmalıdır — ikisi bir-birini tamamlayır.
builder.Services.Configure<CookieOptions>(options =>
{
    options.HttpOnly = true;
    options.Secure   = !builder.Environment.IsDevelopment();
    options.SameSite = SameSiteMode.Strict;
});

// Google OAuth yalnız konfiqurasiyada ClientId/ClientSecret varsa qeydiyyatdan keçirilir.
// Bu şərti yoxlama sayəsində Google açarları olmayan development mühitlərində tətbiq qəzaya uğramır.
var googleClientId = builder.Configuration["Authentication:Google:ClientId"];
var googleClientSecret = builder.Configuration["Authentication:Google:ClientSecret"];
if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    builder.Services.AddAuthentication()
        .AddGoogle(options =>
        {
            options.ClientId = googleClientId;
            options.ClientSecret = googleClientSecret;
            options.CallbackPath = "/signin-google";
            options.SignInScheme = IdentityConstants.ExternalScheme;
            options.ClaimActions.MapJsonKey("google_email_verified", "verified_email");
            options.ClaimActions.MapJsonKey("google_email_verified", "email_verified");
            options.ClaimActions.MapJsonKey("google_hosted_domain", "hd");
        });
}

// ─── 3b. AUTHORIZATION ────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser().Build();
});

//─── 3c. RATE LIMITING ────────────────────────────────────────
// Development mühitində limitlər çox yüksək qoyulur ki, test zamanı bloklanma baş verməsin.
//
// Açar seçimi: sorğu autentifikasiya olunubsa HESAB ID-si, əks halda IP.
// Yalnız IP ilə saymaq iki tərəfdən zəifdir — bax: app.UseRateLimiter() yanındakı qeyd.
string ClientIp(HttpContext ctx) =>
    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

string RateLimitIdentity(HttpContext ctx)
{
    var userId = ctx.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return string.IsNullOrWhiteSpace(userId) ? "ip:" + ClientIp(ctx) : "user:" + userId;
}

bool isDevEnv = builder.Environment.IsDevelopment();

builder.Services.AddRateLimiter(options =>
{
    // 429 Too Many Requests — standart HTTP kodu; limiti keçən sorğular bu cavabı alır.
    options.RejectionStatusCode = 429;

    // ── QLOBAL LİMİT — bütün endpoint-lərə, o cümlədən GƏLƏCƏKDƏ yazılacaqlara ──
    //
    // Niyə lazımdır: [EnableRateLimiting(...)] yazmağı unudulmuş endpoint HEÇ BİR limit
    // altında olmur. Bu, "yeni endpoint = yeni limitsiz səth" deməkdir və audit ilə
    // tutulması çətindir. Qlobal limiter bunu tərsinə çevirir: default = limitli,
    // adlı siyasət yalnız DAHA DAR limit üçün əlavə edilir.
    //
    // Zəncir (CreateChained) hər iki limiti eyni anda tətbiq edir:
    //   1) hesab/IP başına — normal istifadəçi davranışının tavanı;
    //   2) xam IP başına — bir maşından çoxlu hesab açaraq 1-ci limiti keçmə cəhdini bağlayır.
    // Hər ikisi keçilməlidir; biri dolarsa sorğu 429 alır.
    options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: RateLimitIdentity(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = isDevEnv ? 100_000 : 240,
                    Window      = TimeSpan.FromMinutes(1),
                    QueueLimit  = 0
                })),
        PartitionedRateLimiter.Create<HttpContext, string>(context =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: "raw-ip:" + ClientIp(context),
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = isDevEnv ? 100_000 : 600,
                    Window      = TimeSpan.FromMinutes(1),
                    QueueLimit  = 0
                })));

    // Limit dolduqda boş gövdə qaytarmaq olmaz: front-end JSON gözləyir və
    // boş 429-u "naməlum xəta" kimi göstərirdi. Standart ApiResponse formatı + Retry-After.
    options.OnRejected = async (context, cancellationToken) =>
    {
        var retryAfterSeconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? (int)Math.Ceiling(retryAfter.TotalSeconds)
            : 60;

        context.HttpContext.Response.StatusCode  = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            success = false,
            message = $"Çox sayda sorğu göndərildi. {retryAfterSeconds} saniyə sonra yenidən cəhd edin.",
            errors  = new[] { "RATE_LIMIT" }
        }, cancellationToken);
    };

    // Auth: qeydiyyat, giriş, token yenilənməsi — 10/dəq
    // Giriş cəhdlərini məhdudlaşdırmaq brute-force şifrə tapmacalarının qarşısını alır.
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: RateLimitIdentity(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 10,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // Sensitive: şifrə sıfırlama, e-poçt göndərişi — 5/dəq
    // Bu endpoint-lər e-poçt xərcini artıra biləcəyi üçün daha ciddi məhdudlaşdırılıb.
    options.AddPolicy("sensitive", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: RateLimitIdentity(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 5,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // Upload: anonim fayl yükləmə — 5/dəq
    // Yükləmə endpoint-i diskə yazır və heç bir hesabla əlaqələndirilmir, ona görə
    // ümumi "auth" siyasəti ilə deyil, öz daha dar limiti ilə qorunur (disk doldurma vektoru).
    options.AddPolicy("upload", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: RateLimitIdentity(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 5,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // Submit: quiz cavabı göndərmə — 30/dəq.
    // Bu endpoint cavabı yoxlamaqla yanaşı DÜZGÜN AÇARI və bütün izahları qaytarır,
    // yəni sual bankının məzmununu sızdıra bilən yeganə oxu yoludur. Hesaba bağlı
    // dar limit toplu çıxarışı praktiki olaraq mümkünsüz edir və izlənə bilən hala salır.
    options.AddPolicy("submit", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: RateLimitIdentity(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = isDevEnv ? 5000 : 30,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // General: ümumi public endpoint-lər — 60/dəq
    // Normal istifadəçi davranışı üçün kifayət qədər yüksəkdir, lakin bot skriptlərini yavaşladır.
    options.AddPolicy("general", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: RateLimitIdentity(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 5000 : 60,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));
});

// ─── 3d. FORWARDED HEADERS (reverse proxy) ────────────────────
// Nginx / IIS ARR / Cloudflare arxasında tətbiq hər sorğunu proxy-nin IP-si ilə görür.
// Bunun iki nəticəsi var və hər ikisi yalnız production-da üzə çıxır:
//   1) UseHttpsRedirection sonsuz loop-a düşür — proxy app-ə HTTP göndərir, app HTTPS-ə yönləndirir.
//   2) Rate limiting partition açarı RemoteIpAddress-dir — bütün istifadəçilər BİR bucket-a düşür,
//      yəni tək bot bütün saytı bloklaya bilər.
//
// TƏHLÜKƏSİZLİK QEYDİ: X-Forwarded-For başlığını istənilən client saxtalaşdıra bilər.
// Buna görə default olaraq YALNIZ loopback-dən (eyni serverdəki Nginx/IIS) gələn başlıqlara etibar edilir.
// Proxy ayrı maşındadırsa (Cloudflare, xarici load balancer), onun IP-si konfiqurasiyada AÇIQ göstərilməlidir —
// əks halda hücumçu saxta IP göndərib rate limit-i tamamilə keçə bilər.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // Yalnız ən yaxın proxy-yə etibar edilir — zəncirdəki əvvəlki dəyərlər client tərəfindən yazıla bilər.
    options.ForwardLimit = 1;

    var knownProxies = builder.Configuration
        .GetSection("ForwardedHeaders:KnownProxies")
        .GetChildren()
        .Select(c => c.Value)
        .Where(v => !string.IsNullOrWhiteSpace(v))
        .ToArray();

    if (knownProxies.Length > 0)
    {
        var parsedProxies = knownProxies.Select(proxy =>
            System.Net.IPAddress.TryParse(proxy, out var ip) ? ip :
                throw new InvalidOperationException("ForwardedHeaders:KnownProxies ünvanı etibarsızdır.")).ToArray();
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();

        foreach (var ip in parsedProxies)
            options.KnownProxies.Add(ip);
    }
});

// ─── 4. CORS ──────────────────────────────────────────────────
// CORS brauzerə hansı mənbəli saytların bu API-yə müraciət edə biləcəyini bildirir.
// AllowCredentials() httpOnly cookie-lərin (refresh token) cross-origin sorğularda göndərilməsi üçün tələb olunur — onsuz cookie bloklanır.
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        // Sabit production ünvanı həmişə siyahıdadır; konfiqurasiyadan əlavə URL dinamik əlavə edilə bilər.
        // Hər iki kanonik host siyahıdadır. `www` buraxılsa, sayt www-dan açıldıqda
        // BÜTÜN API sorğuları CORS-dan keçmir — brauzer konsolunda görünür, serverdə heç bir log qalmır.
        var configuredOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "https://kiberaz.az",
            "https://www.kiberaz.az"
        };

        var frontendUrl = builder.Configuration["FrontendUrl"];
        if (!string.IsNullOrWhiteSpace(frontendUrl))
            configuredOrigins.Add(frontendUrl.TrimEnd('/'));

        // Development mühitində Vite-in default portları da icazə siyahısına daxil edilir.
        if (builder.Environment.IsDevelopment())
        {
            configuredOrigins.Add("http://localhost:5173");
            configuredOrigins.Add("http://localhost:5174");
            configuredOrigins.Add("http://localhost:5175");
            configuredOrigins.Add("http://127.0.0.1:5173");
            configuredOrigins.Add("http://127.0.0.1:5174");
        }

        // Hər gələn origin normallaşdırılır (sxem+host+port) — sonundakı "/" fərqləri HashSet-də uyğunsuzluğa yol açmasın deyə.
        policy.SetIsOriginAllowed(origin =>
              {
                  if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                      return false;

                  var normalizedOrigin = $"{uri.Scheme}://{uri.Host}{(uri.IsDefaultPort ? string.Empty : $":{uri.Port}")}";
                  return configuredOrigins.Contains(normalizedOrigin);
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ─── 5. SERVICES (DI) ─────────────────────────────────────────
// AddScoped: hər HTTP sorğusu üçün bir nüsxə yaradılır, sorğu bitdikdə məhv edilir.
// Bu, sorğular arasında state paylaşılmamasını təmin edir — əksər servis sinifləri üçün düzgün seçimdir.
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ICourseService, CourseService>();
builder.Services.AddScoped<IUploadService, UploadService>();
builder.Services.AddSingleton(new PdfProcessSanitizer(System.Reflection.Assembly.GetExecutingAssembly().Location));
// Liderlər lövhəsinin snapshot keşi — Singleton olmalıdır ki, bütün sorğular eyni nüsxəni görsün.
// Scoped olsaydı hər sorğu öz boş keşini yaradar və keşin heç bir mənası qalmazdı.
builder.Services.AddSingleton<LeaderboardCache>();
builder.Services.AddScoped<IQuizService, QuizService>();
builder.Services.AddScoped<IExamSessionService, ExamSessionService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ICaptchaService, CaptchaService>();
// Sahib hesabı siyasəti kodda sabit olan sistem hesabını qoruyur — Singleton.
// AdminService və UserService bu siyasətə əsaslanaraq qorunan hesaba müdaxiləni rədd edir.
builder.Services.AddSingleton<ProtectedAccountPolicy>();
builder.Services.AddScoped<IAdminService, AdminService>();
// LiteDbAttemptTracker Singleton-dur: uğursuz giriş cəhdlərini sayır, bu sayğac bütün sorğular arasında ortaq olmalıdır.
// Yaddaş versiyasından (InMemoryAttemptTracker) fərqli olaraq sayğaclar restart-dan sonra da qalır.
// TokenService də Singleton-dur — token imzalama açarını yenidən yükləməmək üçün bir dəfə yaradılır.
builder.Services.AddSingleton<IAttemptTracker, LiteDbAttemptTracker>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient("captcha");
builder.Services.AddHttpContextAccessor();


// ─── 6. FLUENTVALIDATION ─────────────────────────────────────
// RegisterRequestValidator sinifinin tapıldığı assembly-dəki bütün IValidator<T> implementasiyaları avtomatik DI-a qeydiyyatdan keçirilir.
// Bu sayədə hər yeni validator sinfi üçün ayrıca AddScoped<IValidator<...>> yazmaq lazım deyil.
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// ─── 7. CONTROLLERS (ValidationFilter qlobal qeydiyyat) ───────
// ValidationFilter bütün controller action-larına tətbiq olunur — hər endpoint-ə ayrıca [ServiceFilter] yazmaq lazım deyil.
// Bu filter ModelState etibarsız olduqda action metoduna girməzdən əvvəl 400 Bad Request qaytarır.
builder.Services.AddControllers(options =>
    options.Filters.Add<ValidationFilter>());


// ─── 8. SWAGGER (JWT dəstəyi ilə) ────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title       = "Kiberaz.az API",
        Version     = "v1",
        Description = "Kiberaz.az — Azərbaycan Kibertəhlükəsizlik Platforması"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "Bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "JWT token daxil edin: Bearer {token}"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ─── DATABASE SEEDING ─────────────────────────────────────────
// Scoped servis olan RoleManager-ə müraciət etmək üçün müvəqqəti bir scope yaradılır.
// Tətbiq işə düşən kimi "Admin", "Teacher", "Student" rolları bazada yoxdursa avtomatik əlavə edilir.
using (var scope = app.Services.CreateScope())
{
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<AppRole>>();
    await DbInitializer.SeedRolesAsync(roleManager);

    // Yalnız kodda sabitlənmiş hesab Admin saxlanılır. Digər bütün Admin rolları
    // tətbiq sorğu qəbul etməzdən əvvəl silinir və həmin hesabların sessiyaları ləğv olunur.
    var liteDbContext = scope.ServiceProvider.GetRequiredService<LiteDbContext>();
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("SingleAdministrator");
    DbInitializer.EnforceSingleAdministrator(liteDbContext, startupLogger);

    // Sxem miqrasiyası sorğu qəbulundan ƏVVƏL işləyir: köhnə quiz sənədlərində
    // olmayan bool sahələr doldurulur, əks halda həmin suallar sorğulara düşmür.
    // İdempotentdir — düzəldiləcək sənəd yoxdursa heç nə etmir.
    var migrationLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("SchemaMigration");
    DbInitializer.BackfillQuizQuestionFlags(liteDbContext, migrationLogger);

    // CAPTCHA konfiqurasiyası sorğu qəbulundan ƏVVƏL yoxlanılır.
    // Production-da test açarı və ya development bypass aşkarlansa tətbiq QALXMIR —
    // çünki belə server xaricdən tamamilə normal görünür, log-da xəta vermir,
    // sadəcə bot qapısı açıq qalır. Nasazlıq deploy anında görünməlidir.
    var captchaLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("CaptchaConfig");
    CaptchaService.EnsureProductionReady(app.Configuration, app.Environment, captchaLogger);
}

// Quiz kateqoriyaları və sualları seed-data JSON fayllarından bir dəfə yüklənir — verilənlər bazasında artıq kateqoriya varsa atlanır.
using (var scope = app.Services.CreateScope())
{
    var liteDbContext = scope.ServiceProvider.GetRequiredService<LiteDbContext>();
    await QuizSeeder.SeedQuizDataAsync(liteDbContext);
}

// ─── FORWARDED HEADERS (pipeline-ın ƏN BAŞI) ──────────────────
// Bu middleware HttpContext.Connection.RemoteIpAddress və Request.Scheme dəyərlərini düzəldir.
// Ondan sonra gələn HƏR ŞEY (exception logları, rate limiter, HTTPS redirect) düzgün dəyəri görür —
// buna görə mütləq birinci olmalıdır. Development-də proxy yoxdur, ona görə keçilir.
if (!app.Environment.IsDevelopment())
{
    app.UseForwardedHeaders();
}

app.UseMiddleware<ExceptionMiddleware>();

// ─── SECURITY HEADERS ─────────────────────────────────────────
// Bu başlıqlar brauzerə saytın necə davranması barədə təlimat verir — XSS, clickjacking kimi hücumlara qarşı əlavə müdafiə qatı.
// Məsələn X-Frame-Options: DENY saytın iframe içinə yerləşdirilməsini tamamilə qadağan edir.
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    await next();
});


// ─── HTTP PİPELİNE ────────────────────────────────────────────
// Middleware-lərin sırası kritikdir: hər biri növbəti addıma keçməzdən əvvəl öz işini görür.
// Məsələn UseAuthentication mütləq UseAuthorization-dan əvvəl gəlməlidir — əvvəlcə kim olduğun, sonra nəyə icazən var.
if (app.Environment.IsDevelopment())
{
    // Swagger UI yalnız development-də aktiv olur — production-da API sənədləri açıq olmamalıdır.
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Kiberaz.az API v1");
        c.RoutePrefix = string.Empty;
    });
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
// PDFs (including pre-fix uploads) must use the validating download controller.
app.UseWhen(context => !context.Request.Path.Value!.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase),
    branch => branch.UseStaticFiles());

if (!app.Environment.IsDevelopment())
{
    // HSTS brauzərə bu sayta növbəti dəfə yalnız HTTPS ilə müraciət etməsini tövsiyə edir — HTTP-i avtomatik bloklayır.
    app.UseHsts();
}

app.UseRouting();
app.UseCors("FrontendPolicy");
// SIRA VACİBDİR: limiter autentifikasiyadan SONRA qoyulur.
//
// Əvvəl UseAuthentication-dan əvvəl idi — həmin nöqtədə HttpContext.User hələ boş olur,
// yəni limit açarı yalnız IP ola bilərdi. IP açarı iki tərəfdən zəifdir:
//   • bir hesab IP dəyişdirərək limiti sonsuz sıfırlayır;
//   • eyni NAT/məktəb şəbəkəsindəki onlarla real istifadəçi bir bucket-a düşür.
// Autentifikasiyadan sonra hesab ID-si əlçatandır və limit hesaba bağlanır.
//
// Anonim sorğular yenə limitlənir: UseAuthentication heç nəyi rədd etmir, sadəcə
// token varsa User-i doldurur — token yoxdursa açar avtomatik IP-yə düşür.
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.Run();
