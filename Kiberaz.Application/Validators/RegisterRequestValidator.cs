using FluentValidation;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Domain.Common;

namespace Kiberaz.Application.Validators;

// FluentValidation bu sinfi avtomatik tapır və hər RegisterRequest sorğusunda icra edir.
// Qaydalar constructor-da müəyyən edilir — Controller-ə sorğu çatmadan validation tamamlanır.
public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("Ad tələb olunur.")
            .MinimumLength(2).WithMessage("Ad minimum 2 simvol olmalıdır.")
            .MaximumLength(50).WithMessage("Ad 50 simvoldan çox ola bilməz.")
            .Matches(@"^[\p{L}\s\-']+$").WithMessage("Ad yalnız hərf, boşluq və defis ehtiva edə bilər.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Soyad tələb olunur.")
            .MinimumLength(2).WithMessage("Soyad minimum 2 simvol olmalıdır.")
            .MaximumLength(50).WithMessage("Soyad 50 simvoldan çox ola bilməz.")
            .Matches(@"^[\p{L}\s\-']+$").WithMessage("Soyad yalnız hərf, boşluq və defis ehtiva edə bilər.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-poçt tələb olunur.")
            .MinimumLength(6).WithMessage("E-poçt minimum 6 simvol olmalıdır.")
            .MaximumLength(100).WithMessage("E-poçt 100 simvoldan çox ola bilməz.")
            .EmailAddress().WithMessage("Düzgün e-poçt formatı daxil edin.");

        // Regex yalnız latın hərf, rəqəm və alt xəttə icazə verir — xüsusi simvollar URL və sistem
        // daxilindəki istifadədə problem yarada biləcəyi üçün qadağandır.
        RuleFor(x => x.Nickname)
            .NotEmpty().WithMessage("Ləqəb tələb olunur.")
            .MinimumLength(3).WithMessage("Ləqəb minimum 3 simvol olmalıdır.")
            .MaximumLength(16).WithMessage("Ləqəb maksimum 16 simvol ola bilər.")
            .Matches("^[a-zA-Z0-9_]+$").WithMessage("Ləqəbdə yalnız hərf, rəqəm və alt xətt (_) işlənə bilər.");

        RuleFor(x => x.Gender)
            .IsInEnum().WithMessage("Düzgün cins seçin.");

        // Qeydiyyatda yalnız User və Teacher rolları mümkündür — Admin rolu sistem tərəfindən əl ilə təyin edilir.
        RuleFor(x => x.Role)
            .Must(role => role == AppRoles.User || role == AppRoles.Teacher)
            .WithMessage("Rol istifadəçi və ya müəllim olmalıdır.");

        // Hər Matches() ayrıca regex yoxlamasıdır — böyük hərf + rəqəm tələbi şifrəni brute-force-a qarşı gücləndirir.
        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Şifrə tələb olunur.")
            .MinimumLength(8).WithMessage("Şifrə minimum 8 simvol olmalıdır.")
            .MaximumLength(128).WithMessage("Şifrə 128 simvoldan çox ola bilməz.")
            .Matches("[A-Z]").WithMessage("Şifrədə ən azı 1 böyük hərf olmalıdır.")
            .Matches("[0-9]").WithMessage("Şifrədə ən azı 1 rəqəm olmalıdır.");

        RuleFor(x => x.ConfirmPassword)
            .NotEmpty().WithMessage("Şifrə təkrarı tələb olunur.")
            .MaximumLength(128).WithMessage("Şifrə 128 simvoldan çox ola bilməz.")
            .Equal(x => x.Password).WithMessage("Şifrələr uyğun deyil.");

        // When() şərti tokeni yalnız göndərildikdə yoxlayır — CAPTCHA bəzi cəhdlərdə tələb olunmaya bilər.
        RuleFor(x => x.CaptchaToken)
            .MaximumLength(2048).WithMessage("CAPTCHA tokeni etibarsızdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.CaptchaToken));
    }
}
