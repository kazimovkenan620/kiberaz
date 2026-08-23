using FluentValidation;
using Kiberaz.Application.DTOs.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Kiberaz.Api.Filters;

/// <summary>
/// FluentValidation-u ASP.NET Core pipeline-a avtomatik qoşan filter.
/// Action icra olunmazdan əvvəl hər request DTO-sunu validator-dan keçirir.
/// OWASP A03: Injection — İstənilən pis giriş bu filtrdə tutulur.
/// </summary>
// Hər action çağrılmadan əvvəl DTO-ları avtomatik yoxlayan filter — controller-lərdə əl ilə yoxlama yazmağa ehtiyac qalmır.
// FluentValidation validator-ları DI konteynerindən dinamik tapılır, bu səbəbdən hər DTO üçün ayrıca kod yazmaq lazım deyil.
public class ValidationFilter : IAsyncActionFilter
{
    // Action metoduna ötürülən hər arqument üçün uyğun validator axtarır və nəticəyə görə qərar verir.
    // Validator tapılmasa sorğu davam edir; tapılsa və yoxlama uğursuz olarsa 400 qaytarılır.
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument == null) continue;

            // DI-dan uyğun IValidator<T>-i dinamik tapırıq
            // MakeGenericType ilə konkret tip üçün IValidator<LoginDto> kimi tip yaradılır.
            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            var validator = context.HttpContext.RequestServices.GetService(validatorType) as IValidator;

            if (validator == null) continue;

            var validationContext = new ValidationContext<object>(argument);
            var result = await validator.ValidateAsync(validationContext);

            // Yoxlama uğursuz olarsa bütün xəta mesajları toplanıb 400 Bad Request ilə qaytarılır.
            // Action metodu heç vaxt çağrılmır — pis data controller-ə çatmır.
            if (!result.IsValid)
            {
                var errors = result.Errors.Select(e => e.ErrorMessage).ToList();
                var response = ApiResponse<object>.Fail(errors);
                context.Result = new BadRequestObjectResult(response);
                return;
            }
        }

        // Bütün arqumentlər yoxlamadan keçdisə, növbəti addım (action metodu) çağrılır.
        await next();
    }
}
