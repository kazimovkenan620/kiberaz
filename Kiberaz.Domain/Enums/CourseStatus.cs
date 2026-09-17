namespace Kiberaz.Domain.Enums;

/// <summary>
/// Kursun moderasiya statusu.
/// Pending  — Göndərilib (yeni və ya yenidən aktivləşdirmə), admin təsdiqi gözləyir
/// Approved — Təsdiqlənib, platformada görünür (ExpiresAt-a qədər)
/// Rejected — Rədd edilib
/// Expired  — Aktiv müddəti (30 gün) bitib, platformadan çıxarılıb — "Passiv"
/// </summary>
public enum CourseStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Expired = 3
}
