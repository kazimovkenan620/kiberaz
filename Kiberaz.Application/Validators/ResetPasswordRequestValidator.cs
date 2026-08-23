using FluentValidation;
using Kiberaz.Application.DTOs.Auth;

namespace Kiberaz.Application.Validators;

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("İstifadəçi ID-si boş ola bilməz.")
            .MaximumLength(128).WithMessage("İstifadəçi ID-si çox uzundur.");

        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Token boş ola bilməz.")
            .MaximumLength(1024).WithMessage("Token çox uzundur.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Yeni şifrə daxil edin.")
            .MinimumLength(8).WithMessage("Şifrə minimum 8 simvol olmalıdır.")
            .MaximumLength(128).WithMessage("Şifrə maksimum 128 simvol ola bilər.")
            .Matches("[A-Z]").WithMessage("Şifrədə ən azı 1 böyük hərf olmalıdır.")
            .Matches("[0-9]").WithMessage("Şifrədə ən azı 1 rəqəm olmalıdır.");

        RuleFor(x => x.ConfirmPassword)
            .Equal(x => x.NewPassword).WithMessage("Şifrələr uyğun deyil.");
    }
}
