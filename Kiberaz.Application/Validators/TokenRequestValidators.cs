using FluentValidation;
using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.User;

namespace Kiberaz.Application.Validators;

// ─────────────────────────────────────────────────────────────────────────────
// NİYƏ BU FAYL VAR
//
// ValidationFilter yalnız DI-da qeydiyyatlı IValidator<T> tapdığı arqumentləri yoxlayır;
// validatoru olmayan DTO SƏSSİZCƏ keçir. Aşağıdakı sorğular məhz o vəziyyətdə idi —
// e-poçt/Google token sahələri üçün heç bir uzunluq həddi yox idi, yəni meqabaytlarla
// sətir birbaşa Identity token yoxlamasına və LiteDB axtarışına düşə bilirdi.
//
// Hədlər səxavətlidir: real Data Protection tokeni ~200–500 simvoldur, ID isə GUID ölçüsündə.
// Məqsəd düzgün istifadəçini əngəlləmək deyil, hüdudsuz girişi kəsməkdir.
// ─────────────────────────────────────────────────────────────────────────────

public class ConfirmEmailRequestValidator : AbstractValidator<ConfirmEmailRequest>
{
    public ConfirmEmailRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("İstifadəçi ID-si tələb olunur.")
            .MaximumLength(64).WithMessage("İstifadəçi ID-si düzgün deyil.");

        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Təsdiq tokeni tələb olunur.")
            .MaximumLength(2048).WithMessage("Təsdiq tokeni düzgün deyil.");
    }
}

public class ConfirmEmailChangeRequestValidator : AbstractValidator<ConfirmEmailChangeRequest>
{
    public ConfirmEmailChangeRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("İstifadəçi ID-si tələb olunur.")
            .MaximumLength(64).WithMessage("İstifadəçi ID-si düzgün deyil.");

        RuleFor(x => x.NewEmail)
            .NotEmpty().WithMessage("Yeni e-poçt tələb olunur.")
            .MaximumLength(100).WithMessage("E-poçt ən çox 100 simvol ola bilər.")
            .EmailAddress().WithMessage("Düzgün e-poçt formatı daxil edin.");

        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Təsdiq tokeni tələb olunur.")
            .MaximumLength(2048).WithMessage("Təsdiq tokeni düzgün deyil.");
    }
}

public class GoogleLoginExchangeRequestValidator : AbstractValidator<GoogleLoginExchangeRequest>
{
    public GoogleLoginExchangeRequestValidator()
    {
        // Kod serverin özü tərəfindən yaradılır (bir dəfəlik, qısamüddətli) — ölçüsü sabitdir.
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Giriş kodu tələb olunur.")
            .MaximumLength(256).WithMessage("Giriş kodu düzgün deyil.");
    }
}

public class CreateTeacherClassRequestValidator : AbstractValidator<CreateTeacherClassRequest>
{
    public CreateTeacherClassRequestValidator()
    {
        // Servis də eyni həddi yoxlayır (defence in depth) — burada sorğu controller-ə çatmadan kəsilir.
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Sinif adı daxil edin.")
            .MaximumLength(80).WithMessage("Sinif adı maksimum 80 simvol ola bilər.");
    }
}

public class AddStudentToClassRequestValidator : AbstractValidator<AddStudentToClassRequest>
{
    public AddStudentToClassRequestValidator()
    {
        RuleFor(x => x.StudentId)
            .NotEmpty().WithMessage("Tələbə ID-si daxil edin.")
            .MaximumLength(64).WithMessage("Tələbə ID-si düzgün deyil.");
    }
}
