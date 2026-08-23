using FluentValidation;
using Kiberaz.Application.DTOs.Quiz;

namespace Kiberaz.Application.Validators;

public class SubmitAnswerRequestValidator : AbstractValidator<SubmitAnswerRequest>
{
    private static readonly string[] ValidKeys = ["A", "B", "C", "D"];

    public SubmitAnswerRequestValidator()
    {
        RuleFor(x => x.QuestionId)
            .GreaterThan(0).WithMessage("Sual ID-si müsbət olmalıdır.");

        RuleFor(x => x.SelectedKey)
            .NotEmpty().WithMessage("Cavab seçimi tələb olunur.")
            .Must(k => ValidKeys.Contains(k?.ToUpper()))
            .WithMessage("Cavab yalnız A, B, C və ya D ola bilər.");
    }
}
