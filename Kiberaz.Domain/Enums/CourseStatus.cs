namespace Kiberaz.Domain.Enums;

/// <summary>
/// Kursun moderasiya statusu.
/// Pending  — Göndərilib, yoxlanılır
/// Approved — Təsdiqlənib, platformada görünür
/// Rejected — Rədd edilib
/// </summary>
public enum CourseStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}
