using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-poçt daxil edin.")
            .MaximumLength(100).WithMessage("E-poçt maksimum 100 simvol ola bilər.")
            .EmailAddress().WithMessage("Düzgün e-poçt daxil edin.");
    }
}
