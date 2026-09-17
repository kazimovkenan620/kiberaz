using FluentValidation;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Domain.Common;

namespace Kiberaz.Application.Validators;

/// <summary>
/// Admin panelindən təlim yaratma sorğusunun yoxlanması.
///
/// NİYƏ LAZIMDIR: bu yol əvvəl heç bir validatordan keçmirdi — servis yalnız
/// "boşdurmu" yoxlayırdı. Nəticədə uzunluq limiti yox idi və admin yaratdığı təlim
/// dərhal Approved statusu ilə İCTİMAİ ana səhifəyə düşürdü.
/// İctimai kurs formasının 200+ sətirlik validatoru vardı, daha səlahiyyətli admin yolu isə
/// yoxlanmırdı — etibar sərhədi tərsinə qurulmuşdu.
/// </summary>
public class CreateAdminCourseRequestValidator : AbstractValidator<CreateAdminCourseRequest>
{
    public CreateAdminCourseRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Təlim başlığı boş ola bilməz.")
            .MinimumLength(5).WithMessage("Təlim başlığı minimum 5 simvol olmalıdır.")
            .MaximumLength(150).WithMessage("Təlim başlığı ən çox 150 simvol ola bilər.");

        RuleFor(x => x.Instructor)
            .NotEmpty().WithMessage("Müəllim adı boş ola bilməz.")
            .MinimumLength(2).WithMessage("Müəllim adı minimum 2 simvol olmalıdır.")
            .MaximumLength(100).WithMessage("Müəllim adı ən çox 100 simvol ola bilər.");

        RuleFor(x => x.Category)
            .MaximumLength(80).WithMessage("Kateqoriya ən çox 80 simvol ola bilər.")
            .When(x => !string.IsNullOrWhiteSpace(x.Category));

        // TƏHLÜKƏSİZLİK: bu dəyər admin panelində <a href="..."> kimi render olunur.
        // Sxem yoxlanmasa "javascript:..." yazıla bilər və başqa admin kliklədikdə
        // kod cari origin-də, ADMİN SESSİYASINDA icra olunur (target="_blank" bunu dayandırmır).
        // Ona görə yalnız https:// qəbul edilir — ictimai kurs formasındakı qayda ilə eyni.
        RuleFor(x => x.Link)
            .MaximumLength(500).WithMessage("Keçid linki ən çox 500 simvol ola bilər.")
            .Must(url => url is not null && url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Keçid linki HTTPS ilə başlamalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.Link));
    }
}

/// <summary>
/// Admin tərəfindən istifadəçi məlumatlarının düzəlişi.
/// Qaydalar istifadəçinin öz profil formasındakı ilə EYNİDİR — admin yolu daha sərbəst olmamalıdır,
/// əks halda paneldən keçən dəyər (məs. 200 simvolluq ləqəb) sonradan öz formasında redaktə edilə bilmirdi.
/// </summary>
public class AdminUpdateUserRequestValidator : AbstractValidator<AdminUpdateUserRequest>
{
    public AdminUpdateUserRequestValidator()
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
            .NotEmpty().WithMessage("Ləqəb boş ola bilməz.")
            .MinimumLength(3).WithMessage("Ləqəb minimum 3 simvol olmalıdır.")
            .MaximumLength(16).WithMessage("Ləqəb maksimum 16 simvol ola bilər.")
            .Matches("^[a-zA-Z0-9_]+$").WithMessage("Ləqəbdə yalnız hərf, rəqəm və alt xətt (_) işlənə bilər.");

        RuleFor(x => x.Gender)
            .InclusiveBetween(1, 2).WithMessage("Cins 1 (Kişi) və ya 2 (Qadın) olmalıdır.");
    }
}

/// <summary>
/// Admin tərəfindən rol dəyişikliyi sorğusunun yoxlanması.
/// Rolun özü servisdə də yoxlanılır (defence in depth) — burada isə sorğu
/// controller-ə çatmadan kəsilir.
/// </summary>
public class AdminChangeUserRoleRequestValidator : AbstractValidator<AdminChangeUserRoleRequest>
{
    private static readonly string[] AssignableRoles =
    [
        // Admin QƏSDƏN bu siyahıda yoxdur: admin rolu yalnız server konfiqurasiyasından verilir.
        AppRoles.Moderator, AppRoles.VIP, AppRoles.User, AppRoles.Teacher
    ];

    public AdminChangeUserRoleRequestValidator()
    {
        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Rol seçilməlidir.")
            .MaximumLength(32).WithMessage("Rol adı çox uzundur.")
            .Must(role => AssignableRoles.Contains(role))
            .WithMessage("Bu rol paneldən təyin edilə bilməz.");
    }
}
