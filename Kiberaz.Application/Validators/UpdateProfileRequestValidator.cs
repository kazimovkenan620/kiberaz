using FluentValidation;
using Kiberaz.Application.DTOs.User;

namespace Kiberaz.Application.Validators;

// PUT /api/user/profile endpoint-i üçün validasiya.
// FluentValidation middleware bu sinfi avtomatik işlədiri — Controller-ə sorğu çatmadan bütün sahələr yoxlanır.
public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("Ad boş ola bilməz.")
            .MaximumLength(50).WithMessage("Ad maksimum 50 simvol ola bilər.")
            .Matches(@"^[\p{L}\s\-']+$").WithMessage("Ad yalnız hərf, boşluq və defis ehtiva edə bilər.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Soyad boş ola bilməz.")
            .MaximumLength(50).WithMessage("Soyad maksimum 50 simvol ola bilər.")
            .Matches(@"^[\p{L}\s\-']+$").WithMessage("Soyad yalnız hərf, boşluq və defis ehtiva edə bilər.");

        RuleFor(x => x.Nickname)
            .NotEmpty().WithMessage("Nickname boş ola bilməz.")
            .MinimumLength(3).WithMessage("Nickname minimum 3 simvol olmalıdır.")
            .MaximumLength(16).WithMessage("Nickname maksimum 16 simvol ola bilər.")
            .Matches("^[a-zA-Z0-9_]+$").WithMessage("Nickname-də yalnız hərf, rəqəm və alt xətt (_) işlənə bilər.");

        // InclusiveBetween hər iki hədd daxil olmaqla yoxlayır — 1 və 2 qəbul edilir, 0 və 3 rədd edilir.
        RuleFor(x => x.Gender)
            .InclusiveBetween(1, 2).WithMessage("Cins 1 (Kişi) və ya 2 (Qadın) olmalıdır.");
    }
}
