using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Kiberaz.Infrastructure.Services;

// E-poçt məzmununu qurur və EmailQueue-ya atır — SMTP ilə real göndərişi EmailDispatcher (fon) edir.
// Sorğu cavabı SMTP gecikməsindən asılı olmur: hesab varlığı cavab vaxtından sızmır, Gmail ləngiyəndə
// "auth"/"sensitive" limiti altındakı thread-lər tutulmur. Linklərdəki tokenlər fragment-də (#) daşınır.
public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;
    private readonly IHostEnvironment _environment;
    private readonly EmailQueue _queue;

    public EmailService(IConfiguration config, ILogger<EmailService> logger, IHostEnvironment environment, EmailQueue queue)
    {
        _config = config;
        _logger = logger;
        _environment = environment;
        _queue = queue;
    }

    public Task<ApiResponse<bool>> SendConfirmationEmailAsync(string toEmail, string userId, string token)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        var confirmUrl  = $"{frontendUrl}/confirm-email#userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
        return Task.FromResult(Enqueue(toEmail, "Kiberaz.az - Email tesdiqi", BuildEmailHtml(confirmUrl)));
    }

    public Task<ApiResponse<bool>> SendPasswordResetEmailAsync(string toEmail, string userId, string token)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{frontendUrl}/reset-password#userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
        return Task.FromResult(Enqueue(toEmail, "Kiberaz.az - Şifrə yeniləmə", BuildActionEmailHtml(resetUrl, "Şifrəni yenilə")));
    }

    public Task<ApiResponse<bool>> SendEmailChangeConfirmationAsync(string toEmail, string userId, string newEmail, string token)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        var confirmUrl = $"{frontendUrl}/confirm-email-change#userId={Uri.EscapeDataString(userId)}&newEmail={Uri.EscapeDataString(newEmail)}&token={Uri.EscapeDataString(token)}";
        return Task.FromResult(Enqueue(toEmail, "Kiberaz.az - E-poçt dəyişikliyi", BuildActionEmailHtml(confirmUrl, "Dəyişikliyi təsdiqlə")));
    }

    // Konfiqurasiya növbəyə atmazdan ƏVVƏL yoxlanılır: çatışmayan SMTP ayarı sorğu anında görünsün, fon prosesində itməsin.
    private ApiResponse<bool> Enqueue(string toEmail, string subject, string htmlBody)
    {
        try
        {
            var settings = SmtpSender.ReadSettings(_config);
            if (_environment.IsDevelopment() && SmtpSender.IsPlaceholder(settings))
            {
                _logger.LogWarning("SMTP konfiqurasiya edilməyib. E-poçt göndərilmədi: {Subject}", subject);
                return ApiResponse<bool>.Fail("Development rejimi: SMTP konfiqurasiya edilməyib.");
            }
            if (!_queue.TryEnqueue(new EmailJob(toEmail, subject, htmlBody)))
            {
                _logger.LogError("E-poçt növbəsi doludur ({Capacity}); e-poçt atıldı: {Subject}", EmailQueue.Capacity, subject);
                return ApiResponse<bool>.Fail("E-poçt xidməti hazırda məşğuldur. Bir az sonra yenidən cəhd edin.");
            }
            return ApiResponse<bool>.Ok(true, "E-poçt göndərilir.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "E-poçt növbəyə əlavə edilərkən xəta baş verdi.");
            return ApiResponse<bool>.Fail("E-poçt göndərilə bilmədi.");
        }
    }

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

// SMTP göndərişi (MailKit). Singleton; EmailDispatcher çağırır.
public sealed class SmtpSender(IConfiguration config)
{
    public sealed record Settings(string Host, int Port, string FromEmail, string FromName, string Username, string Password);

    public static Settings ReadSettings(IConfiguration config)
    {
        var settings = config.GetSection("EmailSettings");
        return new Settings(
            settings["SmtpHost"] ?? throw new InvalidOperationException("SMTP host konfiqurasiya edilməyib."),
            int.Parse(settings["SmtpPort"] ?? "465"),
            settings["FromEmail"] ?? throw new InvalidOperationException("Göndərici e-poçt konfiqurasiya edilməyib."),
            settings["FromName"] ?? "Kiberaz.az",
            settings["SmtpUsername"] ?? throw new InvalidOperationException("SMTP username konfiqurasiya edilməyib."),
            settings["SmtpPassword"] ?? throw new InvalidOperationException("SMTP password konfiqurasiya edilməyib."));
    }

    public static bool IsPlaceholder(Settings s)
        => string.IsNullOrWhiteSpace(s.Username) || string.IsNullOrWhiteSpace(s.Password)
           || s.Username.Equals("your_email_here", StringComparison.OrdinalIgnoreCase)
           || s.Password.Equals("your_password_here", StringComparison.OrdinalIgnoreCase);

    public async Task SendAsync(EmailJob job, CancellationToken cancellationToken)
    {
        var s = ReadSettings(config);
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(s.FromName, s.FromEmail));
        message.To.Add(MailboxAddress.Parse(job.To));
        message.Subject = job.Subject;
        message.Body = new BodyBuilder { HtmlBody = job.HtmlBody }.ToMessageBody();

        using var client = new SmtpClient { Timeout = 30000 };
        var socketOptions = s.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
        await client.ConnectAsync(s.Host, s.Port, socketOptions, cancellationToken);
        await client.AuthenticateAsync(s.Username, s.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
