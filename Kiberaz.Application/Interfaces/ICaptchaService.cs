namespace Kiberaz.Application.Interfaces;

public interface ICaptchaService
{
    Task<bool> VerifyAsync(string token, string? remoteIp = null);
}
