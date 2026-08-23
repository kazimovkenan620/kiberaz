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
        // Development-də CAPTCHA keçirilir — yalnız "BYPASS" token ilə test edilə bilər
        if (_env.IsDevelopment() && string.IsNullOrWhiteSpace(token))
            return true;

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
            if (!response.IsSuccessStatusCode) return false;

            // Cloudflare JSON cavabından yalnız "success" sahəsini oxuyuruq.
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("success", out var success) && success.GetBoolean();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cloudflare Turnstile doğrulama xətası.");
            return false;
        }
    }
}
