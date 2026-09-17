using Kiberaz.Domain.Common;

namespace Kiberaz.Domain.Entities;

/// <summary>
/// Bir VIP üzvlük dövrü (30 gün). Rolun özü <c>AppUser.Roles</c>-dadır; bu sənəd rolun
/// MÜDDƏTİNİ və dövrə bağlı təlim kreditini saxlayır. Hər ödəniş/təyinat yeni sənəd yaradır —
/// köhnə dövrlər silinmir, tarixçə kimi qalır.
/// </summary>
public class VipTerm : BaseEntity
{
    public string UserId { get; set; } = string.Empty;

    /// <summary>Dövrün başlanğıcı (UTC).</summary>
    public DateTime StartsAt { get; set; }

    /// <summary>Dövrün sonu (UTC, exclusive). Rol geri alınanda "indi"yə çəkilir.</summary>
    public DateTime EndsAt { get; set; }

    /// <summary>Bu dövrdə paylaşıla biləcək təlim sayı. Əlavə ödəniş bunu artırır.</summary>
    public int CourseAllowance { get; set; } = VipPolicy.CoursesPerTerm;

    /// <summary>Bu dövrdə istifadə olunmuş kredit (yaratma + yenidən aktivləşdirmə).</summary>
    public int CoursesUsed { get; set; }

    /// <summary><see cref="VipPolicy.SourceAdmin"/> və ya <see cref="VipPolicy.SourcePayment"/>.</summary>
    public string Source { get; set; } = VipPolicy.SourceAdmin;

    /// <summary>Dövrü açan admin/ödəniş identifikatoru — audit.</summary>
    public string? GrantedBy { get; set; }
}
