using FluentValidation;
using Kiberaz.Application.DTOs.User;
using Kiberaz.Domain.Common;

namespace Kiberaz.Application.Validators;

public class ChangeRoleRequestValidator : AbstractValidator<ChangeRoleRequest>
{
    public ChangeRoleRequestValidator()
    {
        RuleFor(x => x.NewRole)
            .NotEmpty().WithMessage("Rol seçin.")
            .Must(role => role == AppRoles.User || role == AppRoles.Teacher)
            .WithMessage("Yalnız 'İstifadəçi' və ya 'Müəllim' rolu seçilə bilər.");
    }
}