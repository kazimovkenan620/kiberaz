using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// VIP dövrü və təlim krediti üzərində ortaq, sinxron əməliyyatlar.
/// CourseService (kredit istifadəsi) və AdminService (dövr açma / rol dəyişikliyi) eyni qaydanı
/// buradan çağırır ki, "aktiv dövr nədir" sualının bir cavabı olsun.
///
/// Bütün metodlar SİNXRONDUR və çağıranın tutduğu kilid/tranzaksiya içində işləmək üçündür —
/// burada heç bir kilid alınmır, heç bir await yoxdur.
/// </summary>
internal static class VipEntitlements
{
    /// <summary>İstifadəçinin cari (indi daxil) aktiv dövrü; yoxdursa null. Ən gec bitən seçilir.</summary>
    public static VipTerm? ActiveTerm(LiteDbContext db, string userId, DateTime now)
        => db.VipTerms.Find(t => t.UserId == userId && !t.IsDeleted)
            .Where(t => t.StartsAt <= now && t.EndsAt > now)
            .OrderByDescending(t => t.EndsAt)
            .FirstOrDefault();

    /// <summary>
    /// Aktiv dövrün bir kreditini istifadə edir. Uğursuzluq HTTP statuslu xəta ilə qayıdır:
    /// 403 — aktiv VIP dövrü yoxdur; 402 — dövrün krediti bitib (əlavə ödəniş tələb olunur).
    /// Çağıran tərəf VipSyncRoot + tranzaksiya içində olmalıdır.
    /// </summary>
    public static VipTerm ConsumeCourseCredit(LiteDbContext db, AppUser user, DateTime now)
    {
        if (!user.Roles.Contains(AppRoles.VIP))
            throw new RequestFailedException(403,
                "Təlim paylaşmaq yalnız VIP hesablar üçündür.");

        var term = ActiveTerm(db, user.Id, now)
            ?? throw new RequestFailedException(403,
                "Aktiv VIP dövrünüz yoxdur. Yeni təlim paylaşmaq üçün VIP üzvlüyü yeniləyin.");

        if (term.CoursesUsed >= term.CourseAllowance)
            throw new RequestFailedException(402,
                $"Bu VIP dövründə {term.CourseAllowance} təlim paylaşılıb. Növbəti VIP ödənişinə qədər yeni təlim əlavə edilə bilməz; " +
                "eyni dövrdə əlavə təlim üçün əlavə ödəniş tələb olunur (ödəniş sistemi hazır olduqda aktivləşəcək).");

        term.CoursesUsed++;
        term.UpdatedAt = now;
        db.VipTerms.Update(term);
        return term;
    }

    /// <summary>
    /// Yeni dövr açır. Aktiv dövr varsa yenisi onun bitdiyi andan başlayır (ödəniş "uzatma" kimi
    /// işləyir, gün itmir); yoxdursa indidən. Gələcək ödəniş sistemi eyni metodu
    /// <see cref="VipPolicy.SourcePayment"/> ilə çağıracaq.
    /// </summary>
    public static VipTerm StartTerm(LiteDbContext db, string userId, DateTime now, string source, string? grantedBy,
        int days = VipPolicy.TermDays, int allowance = VipPolicy.CoursesPerTerm)
    {
        var active = ActiveTerm(db, userId, now);
        var start = active?.EndsAt ?? now;
        var term = new VipTerm
        {
            UserId = userId, StartsAt = start, EndsAt = start.AddDays(days),
            CourseAllowance = allowance, CoursesUsed = 0, Source = source, GrantedBy = grantedBy, CreatedAt = now
        };
        db.VipTerms.Insert(term);
        return term;
    }

    /// <summary>Rol geri alınanda aktiv/gələcək dövrlər indi bitirilir — kredit rolsuz qalmır.</summary>
    public static void EndTerms(LiteDbContext db, string userId, DateTime now)
    {
        foreach (var term in db.VipTerms.Find(t => t.UserId == userId && !t.IsDeleted).Where(t => t.EndsAt > now).ToList())
        {
            term.EndsAt = now;
            term.UpdatedAt = now;
            db.VipTerms.Update(term);
        }
    }

    public static VipStatusResponse Status(LiteDbContext db, AppUser user, DateTime now)
    {
        var term = ActiveTerm(db, user.Id, now);
        var remaining = term is null ? 0 : Math.Max(0, term.CourseAllowance - term.CoursesUsed);
        return new VipStatusResponse
        {
            HasVipRole = user.Roles.Contains(AppRoles.VIP),
            HasActiveTerm = term is not null,
            TermStartsAt = term?.StartsAt,
            TermEndsAt = term?.EndsAt,
            TermDaysLeft = term is null ? null : Math.Max(0, (int)Math.Ceiling((term.EndsAt - now).TotalDays)),
            CourseAllowance = term?.CourseAllowance ?? 0,
            CoursesUsed = term?.CoursesUsed ?? 0,
            CoursesRemaining = remaining,
            ExtraCourseRequiresPayment = term is not null && remaining == 0,
            TermDays = VipPolicy.TermDays,
            CoursesPerTerm = VipPolicy.CoursesPerTerm,
            CourseActiveDays = VipPolicy.CourseActiveDays
        };
    }
}
