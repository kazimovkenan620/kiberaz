using FluentValidation;
using Kiberaz.Application.DTOs.User;

namespace Kiberaz.Application.Validators;

public class ChangeEmailRequestValidator : AbstractValidator<ChangeEmailRequest>
{
    public ChangeEmailRequestValidator()
    {
        RuleFor(x => x.NewEmail)
            .NotEmpty().WithMessage("Yeni e-poçt tələb olunur.")
            .MinimumLength(6).WithMessage("E-poçt minimum 6 simvol olmalıdır.")
            .MaximumLength(100).WithMessage("E-poçt ən çox 100 simvol ola bilər.")
            .EmailAddress().WithMessage("Düzgün e-poçt formatı daxil edin.");
    }
}
