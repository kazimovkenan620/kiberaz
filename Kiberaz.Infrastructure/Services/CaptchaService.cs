using System.Text.Json;
using Kiberaz.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Kiberaz.Infrastructure.Services;

// Cloudflare Turnstile CAPTCHA doğrulamasını həyata keçirən servis.
// İstifadəçidən gələn CAPTCHA tokenini Cloudflare serverinə göndərir və cavabı yoxlayır — botları sistemdən uzaq saxlamaq üçündür.
public class CaptchaService : ICaptchaService
{
    private const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    /// <summary>
    /// Cloudflare-in resmi TEST secret acarlari. Bunlar real yoxlama etmir:
    /// "1x..." hemise "kecdi", "2x..." hemise "kecmedi", "3x..." ise "token artiq islenib" qaytarir.
    ///
    /// Bu acarlarla isleyen production serveri CAPTCHA-siz serverdir — ustelik xarici gorunusu
    /// normaldir, yalniz widget-in uzerinde kicik "yalniz test ucun" yazisi olur.
    /// Ona gore production-da bunlarin istifadesi konfiqurasiya xetasi sayilir ve
    /// EnsureProductionReady tetbiqi baslamaga qoymur.
    /// </summary>
    private static readonly string[] TestSecretKeys =
    {
        "1x0000000000000000000000000000000AA",
        "2x0000000000000000000000000000000AA",
        "3x0000000000000000000000000000000AA"
    };

    /// <summary>
    /// Tetbiq baslayarken CAPTCHA konfiqurasiyasini yoxlayir ve production-da
    /// yanlis qurulmus halda ACIQ SEKILDE dayandirir.
    ///
    /// Niye startup-da ve niye exception ile? Cunki bu nasazligin hec bir gorunen elameti yoxdur:
    /// qeydiyyat ve giris isleyir, log-da xeta yoxdur, sadece bot qapisi aciq qalir.
    /// Bele nasazliq ise salinarken tutulmalidir, istifadeci sikayeti ile yox.
    /// </summary>
    public static void EnsureProductionReady(IConfiguration config, IHostEnvironment env, ILogger logger)
    {
        var secretKey = config["Captcha:SecretKey"];
        var bypass    = config["Captcha:AllowDevelopmentBypass"];
        var isTestKey = !string.IsNullOrWhiteSpace(secretKey) &&
                        TestSecretKeys.Contains(secretKey, StringComparer.Ordinal);

        if (!env.IsProduction())
        {
            if (isTestKey)
                logger.LogWarning(
                    "CAPTCHA test acari ile isleyir — her token avtomatik qebul edilir. " +
                    "Bu, yalniz lokal muhit ucun qebul olunandir.");
            return;
        }

        if (string.IsNullOrWhiteSpace(secretKey))
            throw new InvalidOperationException(
                "Captcha:SecretKey production-da teyin edilmeyib. CAPTCHA-siz ise dusmek qadagandir.");

        if (isTestKey)
            throw new InvalidOperationException(
                "Captcha:SecretKey Cloudflare-in TEST acaridir — bu acar butun tokenleri qeyd-sertsiz qebul edir, " +
                "yeni CAPTCHA production-da tamamile sondurulmus olur. Cloudflare panelinden real secret acari teyin edin.");

        if (bool.TryParse(bypass, out var bypassEnabled) && bypassEnabled)
            throw new InvalidOperationException(
                "Captcha:AllowDevelopmentBypass production konfiqurasiyasinda true-dur. Bu acar silinmelidir.");
    }

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration     _config;
    private readonly IHostEnvironment   _env;
    private readonly ILogger<CaptchaService> _logger;

    public CaptchaService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        IHostEnvironment env,
        ILogger<CaptchaService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config            = config;
        _env               = env;
        _logger            = logger;
    }

    // İstifadəçinin CAPTCHA cavabını Cloudflare-ə göndərib doğrulayır.
    // Development mühitində boş token qəbul edilir ki, developer-lər CAPTCHA keçmədən test edə bilsin.
    public async Task<bool> VerifyAsync(string token, string? remoteIp = null)
    {
        // CAPTCHA-nın development-də keçilməsi ARTIQ AVTOMATİK DEYİL — açıq konfiqurasiya bayrağı tələb olunur.
        // Səbəb: ASPNETCORE_ENVIRONMENT səhvən "Development" qalmış bir serverdə köhnə davranış
        // bütün CAPTCHA qapılarını səssizcə açırdı. İndi bunun üçün fayla açıq-aydın true yazılmalıdır.
        if (_env.IsDevelopment() &&
            string.IsNullOrWhiteSpace(token) &&
            bool.TryParse(_config["Captcha:AllowDevelopmentBypass"], out var allowBypass) &&
            allowBypass)
        {
            _logger.LogWarning("CAPTCHA development bypass aktivdir — bu ayar yalnız lokal mühit üçündür.");
            return true;
        }

        var secretKey = _config["Captcha:SecretKey"];

        // SecretKey olmadan CAPTCHA yoxlaması mümkün deyil — konfiqurasiya xətasını loglamaq üçün keçirik.
        if (string.IsNullOrWhiteSpace(secretKey))
        {
            // Fail-closed: SecretKey yoxdursa CAPTCHA keçilmir — konfiqurasiya xətası bütün qapıları açmamalıdır.
            _logger.LogError("Captcha:SecretKey konfiqurasiyada tapılmadı — CAPTCHA rədd edilir. Production-da bu sazlanmalıdır.");
            return false;
        }

        if (string.IsNullOrWhiteSpace(token))
            return false;

        var client = _httpClientFactory.CreateClient("captcha");

        // Cloudflare API form-data formatı tələb edir — JSON deyil, URL-encoded göndərilir.
        var formData = new Dictionary<string, string>
        {
            ["secret"]   = secretKey,
            ["response"] = token
        };

        // IP ötürmək məcburi deyil, lakin Cloudflare-in antifraud mexanizminə kömək edir.
        if (!string.IsNullOrWhiteSpace(remoteIp))
            formData["remoteip"] = remoteIp;

        try
        {
            var response = await client.PostAsync(VerifyUrl, new FormUrlEncodedContent(formData));
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Turnstile dogrulama servisi {Status} qaytardi — token redd edilir.", (int)response.StatusCode);
                return false;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var succeeded = root.TryGetProperty("success", out var success) && success.GetBoolean();

            if (!succeeded)
            {
                // Cloudflare ugursuzlugun sebebini "error-codes" massivinde qaytarir
                // (mes. invalid-input-secret, timeout-or-duplicate, invalid-input-response).
                // Evvel bu sahe oxunmurdu: yanlis secret acari ile "butun istifadeciler
                // CAPTCHA-ni kece bilmir" nasazligi log-da izsiz qalirdi.
                var reasons = root.TryGetProperty("error-codes", out var codes) && codes.ValueKind == JsonValueKind.Array
                    ? string.Join(", ", codes.EnumerateArray().Select(c => c.GetString()))
                    : "(sebeb bildirilmedi)";

                _logger.LogWarning("Turnstile tokeni qebul edilmedi. Sebeb: {Reasons}", reasons);
                return false;
            }

            // HOSTNAME YOXLAMASI — mudafienin ikinci qati.
            // Cloudflare token-in hansi domende yaradildigini qaytarir. Sitekey panel
            // seviyyesinde onsuz da domenle baglidir, lakin panel siyahisi sehven genislendirilse,
            // basqa saytda toplanmis token buraya oturule biler. Siyahi konfiqurasiyada
            // verilmeyibse yoxlama aparilmir — movcud qurasdirmalar sinmasin deye.
            // GetChildren() Configuration.Abstractions-dadir; Get<T>() ise ayrica Binder
            // paketi teleb edir — asililigi artirmamaq ucun sade oxunus secilib.
            var allowedHosts = _config.GetSection("Captcha:AllowedHostnames")
                .GetChildren()
                .Select(c => c.Value)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToArray();

            if (allowedHosts.Length > 0 &&
                root.TryGetProperty("hostname", out var hostnameElement))
            {
                var hostname = hostnameElement.GetString();
                if (!allowedHosts.Contains(hostname, StringComparer.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        "Turnstile tokeni gozlenilmeyen domende yaradilib: {Hostname}. Token redd edildi.",
                        hostname);
                    return false;
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cloudflare Turnstile doğrulama xətası.");
            return false;
        }
    }
}
