using FluentValidation;
using Kiberaz.Application.DTOs.Quiz;

namespace Kiberaz.Application.Validators;

public class CreateQuizCategoryRequestValidator : AbstractValidator<CreateQuizCategoryRequest>
{
    public CreateQuizCategoryRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Kateqoriya adı tələb olunur.")
            .MinimumLength(3).WithMessage("Kateqoriya adı minimum 3 simvol olmalıdır.")
            .MaximumLength(80).WithMessage("Kateqoriya adı ən çox 80 simvol ola bilər.");

        // İkon emoji-dir (bir neçə kod nöqtəsi ola bilər); markup/idarəetmə simvolları rədd edilir (audit F8).
        RuleFor(x => x.Icon)
            .NotEmpty().WithMessage("İkon tələb olunur.")
            .MaximumLength(16).WithMessage("İkon ən çox 16 simvol ola bilər.")
            .Matches(@"^[^\p{Cc}<>""'&/\\]+$").WithMessage("İkonda markup və ya idarəetmə simvolu ola bilməz.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Açıqlama tələb olunur.")
            .MinimumLength(10).WithMessage("Açıqlama minimum 10 simvol olmalıdır.")
            .MaximumLength(300).WithMessage("Açıqlama ən çox 300 simvol ola bilər.");

        // Rəng inline stil kimi render olunur — yalnız 6 rəqəmli hex (audit F8).
        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Rəng tələb olunur.")
            .Matches("^#[0-9a-fA-F]{6}$").WithMessage("Rəng #RRGGBB formatında olmalıdır.");

        RuleFor(x => x.Topics)
            .Must(t => t == null || t.Count <= 20).WithMessage("Ən çox 20 mövzu əlavə edə bilərsiniz.")
            .Must(t => t == null || t.All(item => !string.IsNullOrWhiteSpace(item) && item.Length <= 80))
            .WithMessage("Hər mövzu boş olmamaqla ən çox 80 simvol ola bilər.");

        RuleFor(x => x.SortOrder)
            .InclusiveBetween(0, 100).WithMessage("Sıra nömrəsi 0-100 aralığında olmalıdır.");
    }
}
