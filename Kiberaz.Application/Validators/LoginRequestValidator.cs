using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

// Giriş sorğusu üçün minimal validasiya — format və uzunluq yoxlanır.
// Şifrənin düzgünlüyü burada deyil, AuthService-dəki hash müqayisəsində yoxlanır.
public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-poçt ünvanı boş ola bilməz.")
            .EmailAddress().WithMessage("Düzgün e-poçt ünvanı daxil edin.")
            .MaximumLength(64).WithMessage("E-poçt ünvanı 64 simvoldan çox olmamalıdır.");

        // MaximumLength(128) çox uzun şifrə göndərməklə server yükü yaratmağın qarşısını alır.
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifrə boş ola bilməz.")
            .MinimumLength(8).WithMessage("Şifrə ən az 8 simvoldan ibarət olmalıdır.")
            .MaximumLength(128).WithMessage("Şifrə ən çox 128 simvoldan ibarət ola bilər.");
    }
}