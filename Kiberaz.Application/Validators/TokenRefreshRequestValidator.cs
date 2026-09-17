using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

public class TokenRefreshRequestValidator : AbstractValidator<TokenRefreshRequest>
{
    public TokenRefreshRequestValidator()
    {
        // AccessToken məcburi deyil (audit F6): yeni tab-da sessionStorage boşdur, sessiya cookie hash-i ilə tapılır.
        RuleFor(x => x.AccessToken)
            .MaximumLength(2048).WithMessage("Access token çox uzundur.")
            .When(x => !string.IsNullOrWhiteSpace(x.AccessToken));

        // DİQQƏT: RefreshToken burada MƏCBURİ DEYİL — və bu qəsdəndir.
        //
        // Veb client onu body-də göndərmir: refresh token httpOnly cookie-dədir və
        // JavaScript ona toxuna bilmir (XSS qoruması). Controller cookie-dən oxuyur.
        //
        // Əvvəl burada NotEmpty vardı. Qlobal ValidationFilter controller-dən ƏVVƏL işlədiyi üçün
        // sorğu cookie oxunmağa çatmadan 400 alırdı — yəni brauzerdən refresh axını
        // HEÇ VAXT işləmirdi. Nəticə: access token bitən kimi istifadəçi səssizcə çıxarılırdı.
        // Yalnız mobil client-lər body-də göndərəndə uzunluq yoxlanılır.
        RuleFor(x => x.RefreshToken)
            .MaximumLength(128).WithMessage("Refresh token çox uzundur.")
            .When(x => !string.IsNullOrWhiteSpace(x.RefreshToken));
    }
}
