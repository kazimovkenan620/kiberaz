using FluentValidation;
using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.Validators;

/// <summary>
/// Redaktə sorğusu yaratma ilə eyni qaydalardan keçir. ValidationFilter validatoru sorğunun
/// dəqiq tipinə görə tapdığı üçün miras tip üçün ayrıca qeydiyyat lazımdır.
/// </summary>
public class UpdateCourseRequestValidator : AbstractValidator<UpdateCourseRequest>
{
    public UpdateCourseRequestValidator()
    {
        Include(new CreateCourseRequestValidator());
    }
}
