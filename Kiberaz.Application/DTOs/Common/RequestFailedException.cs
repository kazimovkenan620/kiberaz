namespace Kiberaz.Application.DTOs.Common;

/// <summary>
/// Servisdən controller-ə HTTP status daşıyan, istifadəçiyə göstərilə bilən xəta.
/// <see cref="ApiResponse{T}"/> müqaviləsini pozmur: controller tutub
/// <c>StatusCode(e.StatusCode, ApiResponse&lt;object&gt;.Fail(e.Message))</c> qaytarır.
/// Gözlənilməz xətalar bu tipdən DEYİL — onlar ExceptionMiddleware-ə çatır.
/// </summary>
public sealed class RequestFailedException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
