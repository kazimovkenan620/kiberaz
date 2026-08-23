using Kiberaz.Application.DTOs.Common;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// E-poçt göndərmə servisinin müqaviləsi.
/// Infrastructure layeri bu interface-i implement edir.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Hesab aktivləşdirmə linki olan e-poçt göndərir.
    /// </summary>
    Task<ApiResponse<bool>> SendConfirmationEmailAsync(string toEmail, string userId, string token);

    Task<ApiResponse<bool>> SendPasswordResetEmailAsync(string toEmail, string userId, string token);

    Task<ApiResponse<bool>> SendEmailChangeConfirmationAsync(string toEmail, string userId, string newEmail, string token);
}
