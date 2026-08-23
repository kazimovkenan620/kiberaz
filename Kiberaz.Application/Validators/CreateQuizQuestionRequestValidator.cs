using FluentValidation;
using Kiberaz.Application.DTOs.Quiz;

namespace Kiberaz.Application.Validators;

public class CreateQuizQuestionRequestValidator : AbstractValidator<CreateQuizQuestionRequest>
{
    private static readonly string[] ValidDifficulties = ["Başlanğıc", "Orta", "Peşəkar"];
    private static readonly string[] ValidKeys = ["A", "B", "C", "D"];

    public CreateQuizQuestionRequestValidator()
    {
        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("Kateqoriya ID-si müsbət olmalıdır.");

        RuleFor(x => x.Difficulty)
            .NotEmpty().WithMessage("Çətinlik səviyyəsi tələb olunur.")
            .Must(d => ValidDifficulties.Contains(d))
            .WithMessage("Çətinlik Başlanğıc, Orta və ya Peşəkar olmalıdır.");

        RuleFor(x => x.Question)
            .NotEmpty().WithMessage("Sual mətni tələb olunur.")
            .MinimumLength(10).WithMessage("Sual mətni minimum 10 simvol olmalıdır.")
            .MaximumLength(500).WithMessage("Sual mətni ən çox 500 simvol ola bilər.");

        RuleFor(x => x.CorrectKey)
            .NotEmpty().WithMessage("Düzgün cavab açarı tələb olunur.")
            .Must(k => ValidKeys.Contains(k?.ToUpper()))
            .WithMessage("Düzgün cavab açarı yalnız A, B, C və ya D ola bilər.");

        RuleFor(x => x.Options)
            .Must(o => o != null && o.Count == 4)
            .WithMessage("Hər sualın dəqiq 4 cavab seçimi olmalıdır.");

        RuleForEach(x => x.Options).ChildRules(option =>
        {
            option.RuleFor(o => o.Key)
                .NotEmpty().WithMessage("Seçim açarı tələb olunur.")
                .Must(k => ValidKeys.Contains(k?.ToUpper()))
                .WithMessage("Seçim açarı yalnız A, B, C və ya D ola bilər.");

            option.RuleFor(o => o.Text)
                .NotEmpty().WithMessage("Cavab mətni tələb olunur.")
                .MinimumLength(1).WithMessage("Cavab mətni boş ola bilməz.")
                .MaximumLength(300).WithMessage("Cavab mətni ən çox 300 simvol ola bilər.");

            option.RuleFor(o => o.Explanation)
                .NotEmpty().WithMessage("İzah tələb olunur.")
                .MinimumLength(5).WithMessage("İzah minimum 5 simvol olmalıdır.")
                .MaximumLength(1000).WithMessage("İzah ən çox 1000 simvol ola bilər.");
        });
    }
}
