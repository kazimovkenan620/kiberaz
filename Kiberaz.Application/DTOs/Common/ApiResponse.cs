namespace Kiberaz.Application.DTOs.Common;

/// <summary>
/// Bütün API cavabları üçün standart wrapper.
/// Controller heç vaxt raw object qaytarmır — həmişə ApiResponse&lt;T&gt; istifadə edir.
/// </summary>
// Bütün API cavabları üçün standart zarf — frontend həmişə eyni formatda cavab alır.
// Generic T parametri sayəsində istənilən tip data ötürülə bilər: AuthResponse, bool, List<T> və s.
public class ApiResponse<T>
{
    public bool    Success  { get; set; }
    public string  Message  { get; set; } = string.Empty;
    public T?      Data     { get; set; }
    public List<string> Errors { get; set; } = new();

    // Frontend bu bayrağı görüb CAPTCHA widget-ini göstərir — brute-force aşkar edildikdə true olur.
    public bool CaptchaRequired { get; set; }

    // Uğurlu cavab: data doldurulur, Success=true — statik metod olduğu üçün new() yazmadan birbaşa çağırılır.
    public static ApiResponse<T> Ok(T data, string message = "Əməliyyat uğurla tamamlandı.")
        => new() { Success = true, Data = data, Message = message };

    // Tək xəta mesajı üçün qısa yol — captchaRequired parametri brute-force aşkar edildikdə true ötürülür.
    public static ApiResponse<T> Fail(string error, bool captchaRequired = false)
        => new() { Success = false, Errors = { error }, CaptchaRequired = captchaRequired };

    // Bir neçə xəta eyni anda qaytarılmalı olduqda (məsələn FluentValidation xətaları) bu overload istifadə olunur.
    public static ApiResponse<T> Fail(List<string> errors)
        => new() { Success = false, Errors = errors };
}
