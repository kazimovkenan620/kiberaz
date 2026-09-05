using System.Text.RegularExpressions;
using FluentValidation;
using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.Validators;

public class CreateCourseRequestValidator : AbstractValidator<CreateCourseRequest>
{
    // Aralıq səviyyələr də qəbul edilir — Course.Level sənədində nümunə kimi "Başlanğıc → Orta" göstərilib.
    // Əvvəl bu variantlar formda seçilə bilirdi, amma validator onları rədd edirdi: forma göndərilmirdi.
    private static readonly string[] AllowedLevels =
        ["Başlanğıc", "Başlanğıc → Orta", "Orta", "Orta → Peşəkar", "Peşəkar"];

    // UploadService faylı diskə yazıb NİSBİ yol qaytarır: /uploads/photos/{guid}.png
    // "yalnız https://" qaydası isə məhz bu yolu rədd edirdi — yəni platformanın öz yükləmə
    // axını hər dəfə validasiyada ölürdü. Aşağıdakı şablon yalnız BİZİM yaratdığımız
    // yolları tanıyır (GUID + icazəli uzantı), ixtiyari nisbi yol qəbul edilmir.
    private static readonly Regex OwnUploadPath = new(
        @"^/uploads/(photos|syllabus)/[0-9a-fA-F\-]{36}\.(png|jpg|jpeg|webp|pdf)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    // Xarici ünvan yalnız HTTPS ola bilər: http:// qarışıq məzmun yaradır,
    // javascript:/data: isə birbaşa XSS vektorudur.
    private static bool IsAllowedMediaUrl(string? url)
        => url is null
           || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
           || OwnUploadPath.IsMatch(url);
    private static readonly string[] AllowedAccentColors =
    [
        "--brand-primary", "--brand-gold", "--brand-success", "--brand-danger",
        "--text-primary", "--text-secondary"
    ];

    public CreateCourseRequestValidator()
    {
        RuleFor(x => x.InstructorName)
            .NotEmpty().WithMessage("Müəllim adı boş ola bilməz.")
            .MinimumLength(2).WithMessage("Müəllim adı minimum 2 simvol olmalıdır.")
            .MaximumLength(100).WithMessage("Müəllim adı ən çox 100 simvol ola bilər.")
            .Matches(@"^[\p{L}\s\-'.]+$").WithMessage("Müəllim adında yalnız hərf, boşluq, defis istifadə edin.");

        RuleFor(x => x.InstructorRole)
            .NotEmpty().WithMessage("Vəzifə boş ola bilməz.")
            .MinimumLength(2).WithMessage("Vəzifə minimum 2 simvol olmalıdır.")
            .MaximumLength(100).WithMessage("Vəzifə ən çox 100 simvol ola bilər.");

        RuleFor(x => x.InstructorCompany)
            .MaximumLength(100).WithMessage("Şirkət adı ən çox 100 simvol ola bilər.")
            .When(x => !string.IsNullOrWhiteSpace(x.InstructorCompany));

        RuleFor(x => x.InstructorPhotoUrl)
            .MaximumLength(500).WithMessage("Foto URL ən çox 500 simvol ola bilər.")
            .Must(IsAllowedMediaUrl)
            .WithMessage("Foto URL HTTPS ilə başlamalı və ya platformaya yüklənmiş fayl olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.InstructorPhotoUrl));

        RuleFor(x => x.LinkedInUrl)
            .MaximumLength(300).WithMessage("LinkedIn URL ən çox 300 simvol ola bilər.")
            .Must(url => url == null || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            .WithMessage("LinkedIn URL HTTPS ilə başlamalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.LinkedInUrl));

        RuleFor(x => x.GitHubUrl)
            .MaximumLength(300).WithMessage("GitHub URL ən çox 300 simvol ola bilər.")
            .Must(url => url == null || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            .WithMessage("GitHub URL HTTPS ilə başlamalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.GitHubUrl));

        RuleFor(x => x.ContactEmail)
            .MaximumLength(100).WithMessage("E-poçt ən çox 100 simvol ola bilər.")
            .EmailAddress().WithMessage("Düzgün e-poçt ünvanı daxil edin.")
            .When(x => !string.IsNullOrWhiteSpace(x.ContactEmail));

        RuleFor(x => x.ContactPhone)
            .MaximumLength(20).WithMessage("Telefon nömrəsi ən çox 20 simvol ola bilər.")
            .Matches(@"^\+?[0-9\s\-()]{7,20}$").WithMessage("Düzgün telefon nömrəsi daxil edin.")
            .When(x => !string.IsNullOrWhiteSpace(x.ContactPhone));

        RuleFor(x => x.CourseTitle)
            .NotEmpty().WithMessage("Təlim başlığı boş ola bilməz.")
            .MinimumLength(5).WithMessage("Təlim başlığı minimum 5 simvol olmalıdır.")
            .MaximumLength(150).WithMessage("Təlim başlığı ən çox 150 simvol ola bilər.");

        RuleFor(x => x.Kicker)
            .MinimumLength(3).WithMessage("Üst başlıq minimum 3 simvol olmalıdır.")
            .MaximumLength(80).WithMessage("Üst başlıq ən çox 80 simvol ola bilər.")
            .When(x => !string.IsNullOrWhiteSpace(x.Kicker));

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Təlim açıqlaması boş ola bilməz.")
            .MinimumLength(20).WithMessage("Açıqlama minimum 20 simvol olmalıdır.")
            .MaximumLength(2000).WithMessage("Açıqlama ən çox 2000 simvol ola bilər.");

        RuleFor(x => x.Duration)
            .NotEmpty().WithMessage("Müddət boş ola bilməz.")
            .MinimumLength(2).WithMessage("Müddət minimum 2 simvol olmalıdır.")
            .MaximumLength(50).WithMessage("Müddət ən çox 50 simvol ola bilər.");

        RuleFor(x => x.Level)
            .NotEmpty().WithMessage("Səviyyə seçin.")
            .Must(l => AllowedLevels.Contains(l)).WithMessage("Səviyyə Başlanğıc, Orta və ya Peşəkar olmalıdır.");

        RuleFor(x => x.Language)
            .NotEmpty().WithMessage("Dil boş ola bilməz.")
            .MinimumLength(2).WithMessage("Dil minimum 2 simvol olmalıdır.")
            .MaximumLength(50).WithMessage("Dil ən çox 50 simvol ola bilər.");

        RuleFor(x => x.SyllabusTopics)
            .Must(t => t == null || t.Count <= 30).WithMessage("Ən çox 30 mövzu əlavə edə bilərsiniz.")
            .Must(t => t == null || t.All(item => !string.IsNullOrWhiteSpace(item) && item.Length <= 100))
            .WithMessage("Hər mövzu boş olmamaqla ən çox 100 simvol ola bilər.");

        RuleFor(x => x.SyllabusFileUrl)
            .MaximumLength(500).WithMessage("Fayl URL ən çox 500 simvol ola bilər.")
            .Must(IsAllowedMediaUrl)
            .WithMessage("Fayl URL HTTPS ilə başlamalı və ya platformaya yüklənmiş fayl olmalıdır.")
            .When(x => !string.IsNullOrWhiteSpace(x.SyllabusFileUrl));

        RuleFor(x => x.AccentColor)
            .NotEmpty().WithMessage("Rəng seçin.")
            .Must(c => AllowedAccentColors.Contains(c)).WithMessage("Yalnız dizayn sistemindəki rəng tokenləri istifadə edilə bilər.");
    }
}
