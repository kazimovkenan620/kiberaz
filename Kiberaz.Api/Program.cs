using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Kiberaz.Application.Interfaces;
using Kiberaz.Application.Validators;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;
using Kiberaz.Infrastructure.Identity;
using Kiberaz.Infrastructure.Services;
using Kiberaz.Api.Middleware;
using Kiberaz.Api.Filters;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.Google;




var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

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
        ValidIssuer              = jwtSettings["Issuer"],
        ValidAudience            = jwtSettings["Audience"],
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        // ClockSkew sıfırlanır: default olaraq ASP.NET Core tokenin vaxtı keçsə belə 5 dəqiqəlik güzəşt edir.
        // Bunu sıfırlamaq token-in dəqiq müddəti qurtardıqda etibarsız sayılmasını təmin edir.
        ClockSkew                = TimeSpan.Zero
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
        });
}

// ─── 3b. AUTHORIZATION ────────────────────────────────────────
builder.Services.AddAuthorization();

//─── 3c. RATE LIMITING ────────────────────────────────────────
// Rate limiting hər IP ünvanını ayrı "bölmə" (partition) kimi izləyir — bir IP-nin limitin dolması digərlərini etkiləmir.
// Development mühitində limitlər çox yüksək qoyulur ki, test zamanı bloklanma baş verməsin.
builder.Services.AddRateLimiter(options =>
{
    // 429 Too Many Requests — standart HTTP kodu; limiti keçən sorğular bu cavabı alır.
    options.RejectionStatusCode = 429;

    // Auth: qeydiyyat, giriş, token yenilənməsi — 10/dəq
    // Giriş cəhdlərini məhdudlaşdırmaq brute-force şifrə tapmacalarının qarşısını alır.
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 10,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // Sensitive: şifrə sıfırlama, e-poçt göndərişi — 5/dəq
    // Bu endpoint-lər e-poçt xərcini artıra biləcəyi üçün daha ciddi məhdudlaşdırılıb.
    options.AddPolicy("sensitive", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 1000 : 5,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));

    // General: ümumi public endpoint-lər — 60/dəq
    // Normal istifadəçi davranışı üçün kifayət qədər yüksəkdir, lakin bot skriptlərini yavaşladır.
    options.AddPolicy("general", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Environment.IsDevelopment() ? 5000 : 60,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0
        }));
});

// ─── 4. CORS ──────────────────────────────────────────────────
// CORS brauzerə hansı mənbəli saytların bu API-yə müraciət edə biləcəyini bildirir.
// AllowCredentials() httpOnly cookie-lərin (refresh token) cross-origin sorğularda göndərilməsi üçün tələb olunur — onsuz cookie bloklanır.
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        // Sabit production ünvanı həmişə siyahıdadır; konfiqurasiyadan əlavə URL dinamik əlavə edilə bilər.
        var configuredOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "https://kiberaz.az"
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
builder.Services.AddScoped<IQuizService, QuizService>();
builder.Services.AddScoped<ICaptchaService, CaptchaService>();
// InMemoryAttemptTracker Singleton-dur: uğursuz giriş cəhdlərini sayır, bu sayğac bütün sorğular arasında ortaq olmalıdır.
// TokenService də Singleton-dur — token imzalama açarını yenidən yükləməmək üçün bir dəfə yaradılır.
builder.Services.AddSingleton<IAttemptTracker, InMemoryAttemptTracker>();
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
app.UseStaticFiles();

if (!app.Environment.IsDevelopment())
{
    // HSTS brauzərə bu sayta növbəti dəfə yalnız HTTPS ilə müraciət etməsini tövsiyə edir — HTTP-i avtomatik bloklayır.
    app.UseHsts();
}

app.UseCors("FrontendPolicy");
app.UseRouting();
// Rate limiter routing-dən sonra, autentifikasiyadan əvvəl qoyulur — anonim istifadəçiləri də limit altına alır.
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
