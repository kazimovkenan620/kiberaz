using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

public class TokenRefreshRequestValidator : AbstractValidator<TokenRefreshRequest>
{
    public TokenRefreshRequestValidator()
    {
        RuleFor(x => x.AccessToken)
            .NotEmpty().WithMessage("Access token boş ola bilməz.")
            .MaximumLength(2048).WithMessage("Access token çox uzundur.");

        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("Refresh token boş ola bilməz.")
            .MaximumLength(128).WithMessage("Refresh token çox uzundur.");
    }
}
