using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// SMTP vasitəsilə e-poçt göndərən servis.
/// Etimadnamələr (credentials) HEÇVAXT appsettings-ə yazılmır —
/// mütləq environment variable ilə təmin edilir.
/// </summary>
// E-poçt göndərməni idarə edən servis — hesab aktivləşdirmə, şifrə sıfırlama və e-poçt dəyişikliyi üçün istifadə olunur.
// MailKit kitabxanası ilə real SMTP bağlantısı qurulur; token və şəxsi məlumatlar heç vaxt loglanmır.
public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private readonly IHostEnvironment _environment;

    public EmailService(IConfiguration config, ILogger<EmailService> logger, IHostEnvironment environment)
    {
        _config = config;
        _logger = logger;
        _environment = environment;
    }

    /// <inheritdoc />
    // İstifadəçiyə e-poçt təsdiq linki göndərir.
    // Token URL-safe kodlaşdırılır ki, xüsusi simvollar link pozmasın.
    public async Task<ApiResponse<bool>> SendConfirmationEmailAsync(
        string toEmail, string userId, string token)
    {
        try
        {
            var settings  = _config.GetSection("EmailSettings");
            var smtpHost  = settings["SmtpHost"]  ?? throw new InvalidOperationException("SMTP host konfiqurasiya edilməyib.");
            var smtpPort  = int.Parse(settings["SmtpPort"] ?? "465");
            var fromEmail = settings["FromEmail"] ?? throw new InvalidOperationException("Göndərici e-poçt konfiqurasiya edilməyib.");
            var fromName  = settings["FromName"]  ?? "Kiberaz.az";
            var username  = settings["SmtpUsername"] ?? throw new InvalidOperationException("SMTP username konfiqurasiya edilməyib.");
            var password  = settings["SmtpPassword"] ?? throw new InvalidOperationException("SMTP password konfiqurasiya edilməyib.");
            var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";

            // Token URL-safe formata çevrilir
            var encodedToken = Uri.EscapeDataString(token);
            var confirmUrl   = $"{frontendUrl}/confirm-email#userId={Uri.EscapeDataString(userId)}&token={encodedToken}";

            // Development-də də təsdiq tokenini loglamaq olmaz. SMTP yoxdursa əməliyyat
            // açıq şəkildə uğursuz qaytarılır ki, sistem göndərilməmiş məktubu uğurlu saymasın.
            if (_environment.IsDevelopment() && IsSmtpNotConfigured(username, password))
            {
                _logger.LogWarning("SMTP konfiqurasiya edilməyib. Təsdiq e-poçtu göndərilmədi.");
                return ApiResponse<bool>.Fail("Development rejimi: SMTP konfiqurasiya edilməyib.");
            }

            var htmlBody = BuildEmailHtml(confirmUrl);

            await SendHtmlEmailAsync(
                smtpHost,
                smtpPort,
                username,
                password,
                fromEmail,
                fromName,
                toEmail,
                "Kiberaz.az - Email tesdiqi",
                htmlBody);
            _logger.LogInformation("Təsdiq e-poçtu göndərildi.");
            return ApiResponse<bool>.Ok(true, "E-poçt göndərildi.");
        }
        catch (Exception ex)
        {
            // 🛡️ OWASP A09: SMTP xətası loglanır, lakin client-ə açılmır
            _logger.LogError(ex, "Təsdiq e-poçtu göndərilərkən xəta baş verdi.");
            return ApiResponse<bool>.Fail("E-poçt göndərilə bilmədi.");
        }
    }

    /// <summary>Kiberaz.az brendinə uyğun HTML e-poçt şablonu.</summary>
    // Şifrə sıfırlama linkini e-poçtla göndərir.
    // Ümumi SendActionEmailAsync metodunu çağırır — yalnız URL və düymə mətni fərqlənir.
    public Task<ApiResponse<bool>> SendPasswordResetEmailAsync(string toEmail, string userId, string token)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{frontendUrl}/reset-password#userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
        return SendActionEmailAsync(toEmail, "Kiberaz.az - Şifrə yeniləmə", resetUrl, "Şifrəni yenilə");
    }

    // E-poçt dəyişikliyi üçün təsdiq linki göndərir.
    // Yeni e-poçt ünvanı da URL-ə əlavə edilir — backend dəyişikliyi yalnız bu linkin açılmasından sonra tətbiq edir.
    public Task<ApiResponse<bool>> SendEmailChangeConfirmationAsync(string toEmail, string userId, string newEmail, string token)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        var confirmUrl = $"{frontendUrl}/confirm-email-change#userId={Uri.EscapeDataString(userId)}&newEmail={Uri.EscapeDataString(newEmail)}&token={Uri.EscapeDataString(token)}";
        return SendActionEmailAsync(toEmail, "Kiberaz.az - E-poçt dəyişikliyi", confirmUrl, "Dəyişikliyi təsdiqlə");
    }

    // Fərqli e-poçt növlərini (şifrə sıfırlama, e-poçt dəyişikliyi) eyni şablonla göndərən ümumi metod.
    // SMTP konfiqurasiyası oxunur; development daxil olmaqla heç bir mühitdə gizli link loglanmır.
    private async Task<ApiResponse<bool>> SendActionEmailAsync(string toEmail, string subject, string actionUrl, string actionText)
    {
        try
        {
            var settings = _config.GetSection("EmailSettings");
            var smtpHost = settings["SmtpHost"] ?? throw new InvalidOperationException("SMTP host konfiqurasiya edilmeyib.");
            var smtpPort = int.Parse(settings["SmtpPort"] ?? "465");
            var fromEmail = settings["FromEmail"] ?? throw new InvalidOperationException("Göndərici e-poçt konfiqurasiya edilməyib.");
            var fromName = settings["FromName"] ?? "Kiberaz.az";
            var username = settings["SmtpUsername"] ?? throw new InvalidOperationException("SMTP username konfiqurasiya edilmeyib.");
            var password = settings["SmtpPassword"] ?? throw new InvalidOperationException("SMTP password konfiqurasiya edilmeyib.");

            if (_environment.IsDevelopment() && IsSmtpNotConfigured(username, password))
            {
                _logger.LogWarning("SMTP konfiqurasiya edilməyib. Əməliyyat e-poçtu göndərilmədi.");
                return ApiResponse<bool>.Fail("Development rejimi: SMTP konfiqurasiya edilməyib.");
            }

            await SendHtmlEmailAsync(
                smtpHost,
                smtpPort,
                username,
                password,
                fromEmail,
                fromName,
                toEmail,
                subject,
                BuildActionEmailHtml(actionUrl, actionText));
            _logger.LogInformation("Əməliyyat e-poçtu göndərildi.");
            return ApiResponse<bool>.Ok(true, "E-poçt göndərildi.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Əməliyyat e-poçtu göndərilərkən xəta baş verdi.");
            return ApiResponse<bool>.Fail("E-poçt göndərilə bilmədi.");
        }
    }

    // SMTP parolunun "placeholder" dəyər olub-olmadığını yoxlayır.
    // Developer konfiqurasiya etməyi unutsa belə sistem düzgün xəbərdarlıq verir — real parol ilə qarışıqlıq olmur.
    private static bool IsSmtpNotConfigured(string username, string password)
    {
        return string.IsNullOrWhiteSpace(username)
               || string.IsNullOrWhiteSpace(password)
               || username.Equals("your_email_here", StringComparison.OrdinalIgnoreCase)
               || password.Equals("your_password_here", StringComparison.OrdinalIgnoreCase);
    }

    // MailKit ilə real SMTP bağlantısı quraraq HTML e-poçt göndərir.
    // Port 465-də SSL, digər portlarda STARTTLS istifadə olunur — bağlantı şifrələnmiş olur.
    private static async Task SendHtmlEmailAsync(
        string smtpHost,
        int smtpPort,
        string username,
        string password,
        string fromEmail,
        string fromName,
        string toEmail,
        string subject,
        string htmlBody)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient { Timeout = 30000 };

        // Port 465 birbaşa SSL tələb edir; digər portlar (587 kimi) TLS handshake ilə başlayır.
        var socketOptions = smtpPort == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;

        await client.ConnectAsync(smtpHost, smtpPort, socketOptions);
        await client.AuthenticateAsync(username, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }

    // Ümumi əməliyyat e-poçtları üçün sadə HTML şablonu qaytarır.
    // Inline CSS istifadə edilir — e-poçt müştəriləri xarici CSS-i bloklaya bilir.
    private static string BuildActionEmailHtml(string actionUrl, string actionText) => $"""
        <!DOCTYPE html>
        <html lang="az">
        <body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1629;border-radius:12px;border:1px solid #1e2d4a;overflow:hidden;">
                  <tr>
                    <td style="background:#0f2b5b;padding:28px;text-align:center;">
                      <h1 style="margin:0;color:#60a5fa;font-size:26px;font-weight:800;">KIBERAZ.AZ</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:36px;text-align:center;">
                      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
                        Hesab əməliyyatını təsdiqləmək üçün aşağıdakı düyməyə klikləyin.
                      </p>
                      <a href="{actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 34px;border-radius:8px;font-size:16px;font-weight:700;">
                        {actionText}
                      </a>
                      <p style="color:#64748b;font-size:12px;margin:24px 0 0;line-height:1.6;">
                        Link işləmirsə, bu ünvanı brauzerə kopyalayın:<br>
                        <span style="color:#3b82f6;word-break:break-all;">{actionUrl}</span>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;

    // E-poçt təsdiq məktubu üçün tam brendli HTML şablonu qaytarır.
    // Təhlükəsizlik xəbərdarlığı blokunun məqsədi phishing hücumlarına qarşı istifadəçini məlumatlandırmaqdır.
    private static string BuildEmailHtml(string confirmUrl) => $"""
        <!DOCTYPE html>
        <html lang="az">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Kiberaz.az — E-poçt Təsdiqi</title>
        </head>
        <body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0"
                       style="background:#0f1629;border-radius:12px;border:1px solid #1e2d4a;overflow:hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#0f2b5b,#1a3a6e);padding:32px;text-align:center;">
                      <h1 style="margin:0;color:#60a5fa;font-size:28px;font-weight:800;letter-spacing:2px;">
                        KIBERAZ<span style="color:#3b82f6;">.AZ</span>
                      </h1>
                      <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;letter-spacing:1px;">
                        Azərbaycan Kibertəhlükəsizlik Platforması
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 36px;">
                      <h2 style="color:#e2e8f0;font-size:22px;margin:0 0 16px;">
                        🔐 E-poçtunuzu Təsdiqləyin
                      </h2>
                      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
                        Kiberaz.az platformasına qeydiyyatınız uğurla tamamlandı.
                        Hesabınızı aktivləşdirmək üçün aşağıdakı düyməyə klikləyin.
                      </p>

                      <!-- Button -->
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding:8px 0 32px;">
                            <a href="{confirmUrl}"
                               style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);
                                      color:#ffffff;text-decoration:none;padding:16px 40px;
                                      border-radius:8px;font-size:16px;font-weight:700;
                                      letter-spacing:0.5px;">
                              ✅ Hesabı Aktivləşdir
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Warning box -->
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="background:#1a2744;border-left:3px solid #f59e0b;
                                     padding:16px;border-radius:4px;margin-bottom:24px;">
                            <p style="color:#fbbf24;font-size:13px;margin:0 0 4px;font-weight:600;">
                              ⚠️ Təhlükəsizlik Xəbərdarlığı
                            </p>
                            <p style="color:#94a3b8;font-size:13px;margin:0;">
                              Bu linki heç kimlə paylaşmayın. Link 2 saat ərzində etibarlıdır.
                              Əgər bu hesabı siz açmamısınızsa, bu e-poçtu nəzərə almayın.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="color:#64748b;font-size:12px;margin:24px 0 0;line-height:1.6;">
                        Düymə işləmirsə, bu linki brauzerə kopyalayın:<br>
                        <span style="color:#3b82f6;word-break:break-all;">{confirmUrl}</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#080d1a;padding:20px 36px;text-align:center;
                                border-top:1px solid #1e2d4a;">
                      <p style="color:#475569;font-size:12px;margin:0;">
                        © 2025 Kiberaz.az — Bu e-poçtu siz tələb etməmisinizsə, heç bir addım atmağa ehtiyac yoxdur.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;
}
