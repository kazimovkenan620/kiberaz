namespace Kiberaz.Domain.Entities;

/// <summary>
/// Admin panelindən edilən hər dəyişdirici əməliyyatın izi: KİM, NƏYİ, NƏ VAXT.
/// Məqsəd forensikadır — admin tokeni oğurlansa belə nəyin silindiyi/dəyişdiyi görünsün.
/// Qeyd heç vaxt silinmir və dəyişdirilmir (append-only); PII daşımır — e-poçt, token, parol yoxdur.
/// </summary>
public class AdminAuditEntry
{
    public int Id { get; set; }

    /// <summary>Əməliyyatı edən admin hesabın Id-si və o andakı ləqəbi.</summary>
    public string ActorId { get; set; } = string.Empty;
    public string ActorNickname { get; set; } = string.Empty;

    /// <summary>Maşın-oxunan əməliyyat kodu: "course.approve", "user.delete", "question.restore" …</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>"Course" | "User" | "ExamSession" | "QuizCategory" | "QuizQuestion"</summary>
    public string TargetType { get; set; } = string.Empty;
    public string? TargetId { get; set; }

    /// <summary>İnsan üçün qısa izah (servisin qaytardığı Azərbaycanca mesaj).</summary>
    public string Summary { get; set; } = string.Empty;

    /// <summary>Sorğunun gəldiyi IP (ForwardedHeaders-dan sonra). Hash-lənmir — admin öz hərəkətidir.</summary>
    public string? Ip { get; set; }

    public DateTime At { get; set; }
}
