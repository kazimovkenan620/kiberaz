namespace Kiberaz.Application.DTOs.Course;

/// <summary>
/// Sahibin kabinetindəki təlim sətri: ictimai <see cref="CourseResponse"/> + status, müddət,
/// gözləyən dəyişiklik və mümkün əməliyyatlar. Yalnız sahibə qaytarılır.
/// </summary>
public class MyCourseResponse : CourseResponse
{
    /// <summary>"Pending" | "Approved" | "Rejected" | "Expired"</summary>
    public string Status { get; set; } = string.Empty;

    public DateTime? PublishedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Aktiv təlim üçün qalan tam gün; aktiv deyilsə null.</summary>
    public int? DaysLeft { get; set; }

    /// <summary>Admin təsdiqi gözləyən redaktə varmı.</summary>
    public bool HasPendingRevision { get; set; }

    /// <summary>Gözləyən redaktənin məzmunu — sahib formanı bununla doldurur.</summary>
    public CourseRevisionResponse? PendingRevision { get; set; }

    /// <summary>Passiv təlim aktiv VIP dövrü + kreditlə yenidən aktivləşdirilə bilər.</summary>
    public bool CanReactivate { get; set; }
}

/// <summary>Gözləyən redaktənin məzmunu (sahibə və adminə).</summary>
public class CourseRevisionResponse : CreateCourseRequest
{
    public DateTime SubmittedAt { get; set; }
}

/// <summary>
/// İstifadəçinin VIP vəziyyəti — kabinet və "Təlim əlavə et" düyməsi üçün.
/// Məlumat məqsədlidir: həqiqi hüquq serverdə, yazı anında, kilid altında yoxlanılır.
/// </summary>
public class VipStatusResponse
{
    public bool HasVipRole { get; set; }
    public bool HasActiveTerm { get; set; }
    public DateTime? TermStartsAt { get; set; }
    public DateTime? TermEndsAt { get; set; }
    public int? TermDaysLeft { get; set; }
    public int CourseAllowance { get; set; }
    public int CoursesUsed { get; set; }
    public int CoursesRemaining { get; set; }

    /// <summary>Aktiv dövrdə kredit bitib — əlavə təlim əlavə ödəniş tələb edir (ödəniş sistemi gələcəkdə).</summary>
    public bool ExtraCourseRequiresPayment { get; set; }

    /// <summary>Dövr uzunluğu və hər dövrün krediti — UI mətnləri üçün.</summary>
    public int TermDays { get; set; }
    public int CoursesPerTerm { get; set; }
    public int CourseActiveDays { get; set; }
}
