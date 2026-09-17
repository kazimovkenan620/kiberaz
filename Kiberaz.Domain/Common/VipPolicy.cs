namespace Kiberaz.Domain.Common;

/// <summary>
/// VIP üzvlük və təlim paylaşma hüququnun biznes qaydaları — tək həqiqət mənbəyi.
///
/// Model: VIP üzvlük DÖVRLƏRLƏ (VipTerm) ölçülür. Hər dövr 30 gündür və 1 təlim paylaşma
/// hüququ (kredit) verir. Kredit dövrlə birlikdə bitir — növbəti dövr (növbəti ödəniş) yeni
/// kredit gətirir. Eyni dövrdə 2-ci təlim əlavə ödəniş tələb edir: ödəniş sistemi hazır olduqda
/// <c>VipTerm.CourseAllowance</c> artırılır, başqa heç bir kod dəyişmir.
///
/// Təlimin ömrü dövrdən ASILI DEYİL: admin təsdiqlədiyi andan 30 gün aktiv qalır (dövr 2 gün
/// sonra bitsə belə), sonra "Passiv" olur. Passiv təlimi yenidən aktivləşdirmək yeni kredit
/// (yəni aktiv VIP dövrü) tələb edir.
/// </summary>
public static class VipPolicy
{
    /// <summary>Bir VIP dövrünün uzunluğu (gün).</summary>
    public const int TermDays = 30;

    /// <summary>Hər dövrün standart təlim paylaşma hüququ.</summary>
    public const int CoursesPerTerm = 1;

    /// <summary>Təsdiqlənmiş təlimin platformada aktiv qaldığı müddət (gün).</summary>
    public const int CourseActiveDays = 30;

    /// <summary>Dövrün mənbəyi — audit üçün. Gələcək ödəniş sistemi <see cref="SourcePayment"/> yazacaq.</summary>
    public const string SourceAdmin = "Admin";
    public const string SourcePayment = "Payment";
}
