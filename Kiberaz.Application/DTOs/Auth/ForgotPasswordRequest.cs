namespace Kiberaz.Application.DTOs.Auth;

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
    public string CaptchaToken { get; set; } = string.Empty;
}
