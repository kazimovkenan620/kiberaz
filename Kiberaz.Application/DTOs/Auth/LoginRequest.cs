namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// İstifadəçi girişi üçün DTO.
/// Təhlükəsizlik: "Şifrə yanlışdır" və ya "İstifadəçi tapılmadı" deyil,
/// həmişə "Etimadnamələr yanlışdır" qaytarılır — information leakage önlənir.
/// </summary>
public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? CaptchaToken { get; set; }
}
