using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

public class ResendConfirmationEmailRequestValidator : AbstractValidator<ResendConfirmationEmailRequest>
{
    public ResendConfirmationEmailRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-poçt ünvanı boş ola bilməz.")
            .EmailAddress().WithMessage("Düzgün e-poçt ünvanı daxil edin.")
            .MaximumLength(100).WithMessage("E-poçt maksimum 100 simvol ola bilər.");
    }
}
