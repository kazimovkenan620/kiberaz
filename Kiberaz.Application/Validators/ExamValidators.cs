using FluentValidation;
using Kiberaz.Application.DTOs.Exam;
using Kiberaz.Domain.Common;

namespace Kiberaz.Application.Validators;

/// <summary>
/// İmtahan sessiyası yaratma sorğusunun yoxlanması (yalnız VIP hesablar üçün açıqdır).
///
/// NİYƏ LAZIMDIR: bu DTO əvvəl heç bir validatordan keçmirdi — bütün yoxlama servisin
/// içində, ExamSyncRoot kilidi ALTINDA aparılırdı. Yəni pis formalı sorğu belə tələbələrin
/// cavab yazılarını gözlədirdi. İndi forma xətaları controller-ə çatmadan kəsilir;
/// biznes invariantları (kateqoriya mövcudluğu, günlük limit) isə servisdə, kilid altında qalır.
/// </summary>
public class CreateExamRequestValidator : AbstractValidator<CreateExamRequest>
{
    public CreateExamRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Sessiyanın adı boş ola bilməz.")
            .Must(t => t is not null && t.Trim().Length >= 3).WithMessage("Sessiyanın adı minimum 3 simvol olmalıdır.")
            .MaximumLength(ExamPolicy.MaxTitleLength).WithMessage($"Sessiyanın adı ən çox {ExamPolicy.MaxTitleLength} simvol ola bilər.");

        RuleFor(x => x.DurationMinutes)
            .InclusiveBetween(ExamPolicy.MinDurationMinutes, ExamPolicy.MaxDurationMinutes)
            .WithMessage($"Müddət {ExamPolicy.MinDurationMinutes}–{ExamPolicy.MaxDurationMinutes} dəqiqə aralığında olmalıdır.");

        RuleFor(x => x.Categories)
            .NotNull().WithMessage("Ən azı bir kateqoriya seçin.")
            .Must(c => c is { Count: >= 1 } && c.Count <= ExamPolicy.MaxCategoriesPerSession)
            .WithMessage($"1–{ExamPolicy.MaxCategoriesPerSession} kateqoriya seçin.")
            .Must(c => c is not null && c.All(s => s is not null))
            .WithMessage("Kateqoriya seçimi düzgün deyil.")
            .Must(c => c is not null && c.All(s => s is null || s.CategoryId > 0))
            .WithMessage("Kateqoriya identifikatoru düzgün deyil.")
            .Must(c => c is not null && c.All(s => s is null || s.Count is >= 1 and <= ExamPolicy.MaxQuestionsPerSession))
            .WithMessage($"Hər kateqoriya üzrə 1–{ExamPolicy.MaxQuestionsPerSession} sual seçin.")
            .Must(c => c is not null && c.Where(s => s is not null).Sum(s => (long)s.Count) <= ExamPolicy.MaxQuestionsPerSession)
            .WithMessage($"Bir sessiyada cəmi ən çox {ExamPolicy.MaxQuestionsPerSession} sual ola bilər.")
            .Must(c => c is not null && c.Where(s => s is not null).Select(s => s.CategoryId).Distinct().Count() == c.Count(s => s is not null))
            .WithMessage("Eyni kateqoriya iki dəfə seçilə bilməz.");
    }
}

/// <summary>Sessiyaya qoşulma kodu: "KBR-" + 16 hex simvol. Format burada, mövcudluq servisdə yoxlanılır.</summary>
public class JoinExamRequestValidator : AbstractValidator<JoinExamRequest>
{
    public JoinExamRequestValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Sessiya kodunu daxil edin.")
            .Must(code =>
            {
                var value = code?.Trim().ToUpperInvariant() ?? "";
                return value.Length == ExamPolicy.CodeLength && value.StartsWith(ExamPolicy.CodePrefix, StringComparison.Ordinal)
                    && value[ExamPolicy.CodePrefix.Length..].All(Uri.IsHexDigit);
            })
            .WithMessage("Kodu KBR-1234567890ABCDEF formatında daxil edin.");
    }
}

/// <summary>Cavab yazısı: sual id-si 32 hex, variant açarı qısa hərf/rəqəm, revizyon mənfi ola bilməz.</summary>
public class SaveExamAnswerRequestValidator : AbstractValidator<SaveExamAnswerRequest>
{
    public SaveExamAnswerRequestValidator()
    {
        RuleFor(x => x.QuestionId)
            .NotEmpty().WithMessage("Sual identifikatoru boşdur.")
            .Must(id => id is { Length: 32 } && id.All(Uri.IsHexDigit))
            .WithMessage("Sual identifikatoru düzgün deyil.");

        RuleFor(x => x.OptionKey)
            .NotEmpty().WithMessage("Cavab variantı seçilməlidir.")
            .MaximumLength(8).WithMessage("Cavab variantı düzgün deyil.")
            .Must(key => key is not null && key.All(char.IsLetterOrDigit))
            .WithMessage("Cavab variantı düzgün deyil.");

        RuleFor(x => x.Revision)
            .GreaterThanOrEqualTo(0).WithMessage("Revizyon dəyəri düzgün deyil.");
    }
}
