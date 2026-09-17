using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Təlim idarəetmə servisi (VIP təlim paylaşma modeli).
///
/// Qaydalar (VipPolicy):
///  • Təlimi yalnız VIP rolu + aktiv 30 günlük VIP dövrü + dövrdə qalan kredit (standart 1) ilə paylaşmaq olar.
///    Kredit "oxu → müqayisə → yaz" ardıcıllığı ilə <see cref="LiteDbContext.VipSyncRoot"/> altında istifadə edilir —
///    iki paralel sorğu eyni krediti iki dəfə xərcləyə bilməz.
///  • Hər dəyişiklik admin təsdiqindən keçir. Aktiv (təsdiqli) təlimin redaktəsi gözləyən revizyon kimi saxlanır;
///    canlı nəşr admin təsdiqləyənə qədər DƏYİŞMİR və 30 günlük müddət də sıfırlanmır.
///  • Təsdiqlənmiş təlim PublishedAt + 30 gün aktiv qalır, sonra <see cref="ExpireOverdueCoursesAsync"/> ilə passivə düşür
///    (ictimai siyahı bundan asılı olmadan da vaxta görə süzür — fon işi gecikə bilər, sızma olmur).
///  • Passiv təlimi yenidən aktivləşdirmək yeni kredit tələb edir və yenidən moderasiyaya düşür.
///  • Silmə soft delete-dir; kredit geri qaytarılmır (əks halda "yarat-sil-yarat" ilə limit keçilərdi).
///
/// Sahiblik: hər əməliyyat <c>SubmittedByUserId == userId</c> yoxlayır; başqasının təlimi 403 deyil,
/// 404 qaytarır ki, Id-lərin mövcudluğu sızmasın.
/// </summary>
public class CourseService(LiteDbContext db, TimeProvider clock) : ICourseService
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    // ═══════════════════════════════════════════════════════════
    // İCTİMAİ OXU
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<List<CourseResponse>>> GetApprovedCoursesAsync()
    {
        ExpireOverdue();
        var now = Now;
        var courses = db.Courses
            .Find(c => !c.IsDeleted && c.Status == CourseStatus.Approved)
            // Fon işi hələ keçirməyibsə belə, müddəti bitmiş təlim ictimai siyahıya düşmür.
            .Where(c => c.ExpiresAt is null || c.ExpiresAt > now)
            .OrderByDescending(c => c.PublishedAt ?? c.CreatedAt)
            .Select(MapToResponse)
            .ToList();
        return Task.FromResult(ApiResponse<List<CourseResponse>>.Ok(courses));
    }

    public Task<ApiResponse<CourseResponse>> GetCourseByIdAsync(int id)
    {
        // Yalnız TƏSDİQLƏNMİŞ və müddəti bitməmiş təlim publik oxuna bilər — gözləyən/rədd/passiv
        // təlimin detalları Id sınamaqla oxunmur.
        var now = Now;
        var course = db.Courses.FindOne(c => c.Id == id && !c.IsDeleted && c.Status == CourseStatus.Approved);
        if (course is null || (course.ExpiresAt is not null && course.ExpiresAt <= now))
            return Task.FromResult(ApiResponse<CourseResponse>.Fail("Təlim tapılmadı."));
        return Task.FromResult(ApiResponse<CourseResponse>.Ok(MapToResponse(course)));
    }

    // ═══════════════════════════════════════════════════════════
    // SAHİB (VIP) ƏMƏLİYYATLARI
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<CourseResponse>> CreateCourseAsync(CreateCourseRequest request, string userId)
    {
        var course = Atomic(() =>
        {
            var user = Owner(userId);
            var now = Now;
            // Kredit əvvəl xərclənir — uğursuzsa tranzaksiya geri alınır, heç nə yazılmır.
            // Kredit xərclənməzdən əvvəl: istinad olunan fayllar bu hesaba aiddirmi?
            UploadLedger.EnsureOwnedBy(db, userId, null, request.InstructorPhotoUrl, request.SyllabusFileUrl);
            var term = VipEntitlements.ConsumeCourseCredit(db, user, now);

            var entity = new Course
            {
                Status = CourseStatus.Pending, SubmittedByUserId = userId, VipTermId = term.Id, CreatedAt = now
            };
            ApplyContent(entity, request);
            db.Courses.Insert(entity);
            UploadLedger.SyncClaims(db, entity, now);
            return entity;
        });

        return Task.FromResult(ApiResponse<CourseResponse>.Ok(MapToResponse(course),
            "Təliminiz qeydə alındı. Admin təsdiqlədikdən sonra 30 gün ərzində saytda görünəcək."));
    }

    public Task<ApiResponse<List<MyCourseResponse>>> GetMyCoursesAsync(string userId)
    {
        ExpireOverdue();
        var now = Now;
        var canReactivate = CanReactivate(userId, now);
        var courses = db.Courses
            .Find(c => c.SubmittedByUserId == userId && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => MapToMine(c, now, canReactivate))
            .ToList();
        return Task.FromResult(ApiResponse<List<MyCourseResponse>>.Ok(courses));
    }

    public Task<ApiResponse<MyCourseResponse>> UpdateCourseAsync(int id, string userId, UpdateCourseRequest request)
    {
        var message = "";
        var course = Atomic(() =>
        {
            Owner(userId);
            var now = Now;
            var entity = OwnedCourse(id, userId);
            ExpireIfOverdue(entity, now);
            UploadLedger.EnsureOwnedBy(db, userId, entity.Id, request.InstructorPhotoUrl, request.SyllabusFileUrl);

            if (entity.Status == CourseStatus.Approved)
            {
                // Canlı nəşr toxunulmur: dəyişiklik admin təsdiqinə qədər revizyon kimi gözləyir,
                // aktiv müddət (ExpiresAt) dəyişmir.
                entity.PendingRevision = ToRevision(request, now);
                message = "Dəyişiklik admin təsdiqinə göndərildi. Təsdiqlənənə qədər saytda əvvəlki versiya görünür.";
            }
            else
            {
                // Gözləyən / rədd edilmiş / passiv təlim saytda görünmür — məzmun birbaşa yazılır.
                ApplyContent(entity, request);
                entity.PendingRevision = null;
                if (entity.Status == CourseStatus.Rejected)
                {
                    entity.Status = CourseStatus.Pending; // rədd edilmiş təlim düzəlişdən sonra yenidən moderasiyaya düşür
                    message = "Təlim yeniləndi və yenidən admin təsdiqinə göndərildi.";
                }
                else message = entity.Status == CourseStatus.Expired
                    ? "Passiv təlim yeniləndi. Saytda görünməsi üçün yenidən aktivləşdirin."
                    : "Təlim yeniləndi; admin təsdiqi gözlənilir.";
            }
            entity.UpdatedAt = now;
            db.Courses.Update(entity);
            UploadLedger.SyncClaims(db, entity, now);
            return entity;
        });
        var now = Now;
        return Task.FromResult(ApiResponse<MyCourseResponse>.Ok(MapToMine(course, now, CanReactivate(userId, now)), message));
    }

    public Task<ApiResponse<bool>> DeleteCourseAsync(int id, string userId)
    {
        Atomic(() =>
        {
            Owner(userId);
            var entity = OwnedCourse(id, userId);
            entity.IsDeleted = true;
            entity.PendingRevision = null;
            var now = Now;
            entity.UpdatedAt = now;
            db.Courses.Update(entity);
            UploadLedger.SyncClaims(db, entity, now); // fayllar azad olur; süpürgə TTL-dən sonra silir
            return true;
        });
        return Task.FromResult(ApiResponse<bool>.Ok(true, "Təlim silindi. İstifadə olunmuş VIP krediti geri qaytarılmır."));
    }

    public Task<ApiResponse<MyCourseResponse>> ReactivateCourseAsync(int id, string userId)
    {
        var course = Atomic(() =>
        {
            var user = Owner(userId);
            var now = Now;
            var entity = OwnedCourse(id, userId);
            ExpireIfOverdue(entity, now);
            if (entity.Status != CourseStatus.Expired)
                throw new RequestFailedException(409, entity.Status == CourseStatus.Approved
                    ? "Bu təlim artıq aktivdir."
                    : "Yalnız passiv (müddəti bitmiş) təlim yenidən aktivləşdirilə bilər.");

            var term = VipEntitlements.ConsumeCourseCredit(db, user, now);
            entity.Status = CourseStatus.Pending; // admin təsdiqindən sonra yeni 30 günlük müddət açılır
            entity.VipTermId = term.Id;
            entity.UpdatedAt = now;
            db.Courses.Update(entity);
            return entity;
        });
        var now = Now;
        return Task.FromResult(ApiResponse<MyCourseResponse>.Ok(MapToMine(course, now, CanReactivate(userId, now)),
            "Yenidən aktivləşdirmə sorğusu göndərildi. Admin təsdiqləyəndən sonra təlim 30 gün aktiv olacaq."));
    }

    public Task<ApiResponse<VipStatusResponse>> GetVipStatusAsync(string userId)
    {
        var user = db.Users.FindById(userId) ?? throw new RequestFailedException(401, "Hesab tapılmadı. Yenidən daxil olun.");
        return Task.FromResult(ApiResponse<VipStatusResponse>.Ok(VipEntitlements.Status(db, user, Now)));
    }

    public Task<int> ExpireOverdueCoursesAsync() => Task.FromResult(ExpireOverdue());

    // ═══════════════════════════════════════════════════════════
    // PRIVATE
    // ═══════════════════════════════════════════════════════════

    // Kredit və status dəyişiklikləri VipSyncRoot altında, bir tranzaksiyada. No await inside.
    private T Atomic<T>(Func<T> action)
    {
        lock (db.VipSyncRoot)
        {
            db.Database.BeginTrans();
            try { var value = action(); db.Database.Commit(); return value; }
            catch { db.Database.Rollback(); throw; }
        }
    }

    /// <summary>Müddəti bitmiş təsdiqli təlimləri passivə keçirir; sayını qaytarır.</summary>
    private int ExpireOverdue()
    {
        var now = Now;
        // Ucuz ön yoxlama kilidsiz: keçiriləcək heç nə yoxdursa kilidə girilmir.
        // Tarix müqayisəsi yaddaşda aparılır (nullable DateTime LiteDB ifadəsinə çevrilmir); təsdiqli təlim sayı kiçikdir.
        if (!Overdue(now).Any())
            return 0;
        return Atomic(() =>
        {
            var count = 0;
            foreach (var course in Overdue(now).ToList())
            {
                course.Status = CourseStatus.Expired;
                course.UpdatedAt = now;
                db.Courses.Update(course);
                count++;
            }
            return count;
        });
    }

    private IEnumerable<Course> Overdue(DateTime now) => db.Courses
        .Find(c => !c.IsDeleted && c.Status == CourseStatus.Approved)
        .Where(c => c.ExpiresAt is not null && c.ExpiresAt <= now);

    /// <summary>Sahib passiv təlimi yenidən aktivləşdirə bilərmi: VIP rolu + aktiv dövr + qalan kredit.</summary>
    private bool CanReactivate(string userId, DateTime now)
    {
        var user = db.Users.FindById(userId);
        return user is not null && user.Roles.Contains(AppRoles.VIP) &&
               VipEntitlements.ActiveTerm(db, userId, now) is { } term && term.CoursesUsed < term.CourseAllowance;
    }

    private void ExpireIfOverdue(Course course, DateTime now)
    {
        if (course.Status == CourseStatus.Approved && course.ExpiresAt is not null && course.ExpiresAt <= now)
        {
            course.Status = CourseStatus.Expired;
            course.UpdatedAt = now;
        }
    }

    private AppUser Owner(string userId)
    {
        var user = db.Users.FindById(userId) ?? throw new RequestFailedException(401, "Hesab tapılmadı. Yenidən daxil olun.");
        if (ProtectedAccountPolicy.IsHiddenAccount(user))
            throw new RequestFailedException(403, "Admin hesabı təlimləri admin panelindən idarə edir.");
        return user;
    }

    private Course OwnedCourse(int id, string userId)
    {
        var course = db.Courses.FindOne(c => c.Id == id && !c.IsDeleted);
        if (course is null || !string.Equals(course.SubmittedByUserId, userId, StringComparison.Ordinal))
            throw new RequestFailedException(404, "Təlim tapılmadı.");
        return course;
    }

    /// <summary>
    /// Sorğunun məzmununu canlı sahələrin üzərinə yazır. AdminService də istifadə edir
    /// (admin birbaşa redaktəsi) — qayda bir yerdə olsun deyə `internal`.
    /// </summary>
    internal static void ApplyContent(Course course, CreateCourseRequest request)
    {
        course.InstructorName     = request.InstructorName.Trim();
        course.InstructorRole     = request.InstructorRole.Trim();
        course.InstructorCompany  = Clean(request.InstructorCompany);
        course.InstructorPhotoUrl = Clean(request.InstructorPhotoUrl);
        course.LinkedInUrl        = Clean(request.LinkedInUrl);
        course.GitHubUrl          = Clean(request.GitHubUrl);
        course.ContactEmail       = Clean(request.ContactEmail);
        course.ContactPhone       = Clean(request.ContactPhone);
        course.CourseTitle        = request.CourseTitle.Trim();
        course.Kicker             = Clean(request.Kicker);
        course.Description        = request.Description.Trim();
        course.Duration           = request.Duration.Trim();
        course.Level              = request.Level.Trim();
        course.Language           = request.Language.Trim();
        course.SyllabusTopics     = Topics(request.SyllabusTopics);
        course.SyllabusFileUrl    = Clean(request.SyllabusFileUrl);
        course.AccentColor        = request.AccentColor.Trim();
    }

    private static CourseRevision ToRevision(CreateCourseRequest request, DateTime now) => new()
    {
        InstructorName = request.InstructorName.Trim(), InstructorRole = request.InstructorRole.Trim(),
        InstructorCompany = Clean(request.InstructorCompany), InstructorPhotoUrl = Clean(request.InstructorPhotoUrl),
        LinkedInUrl = Clean(request.LinkedInUrl), GitHubUrl = Clean(request.GitHubUrl),
        ContactEmail = Clean(request.ContactEmail), ContactPhone = Clean(request.ContactPhone),
        CourseTitle = request.CourseTitle.Trim(), Kicker = Clean(request.Kicker), Description = request.Description.Trim(),
        Duration = request.Duration.Trim(), Level = request.Level.Trim(), Language = request.Language.Trim(),
        SyllabusTopics = Topics(request.SyllabusTopics), SyllabusFileUrl = Clean(request.SyllabusFileUrl),
        AccentColor = request.AccentColor.Trim(), SubmittedAt = now
    };

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static List<string> Topics(List<string>? topics) => (topics ?? [])
        .Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).ToList();

    private static CourseResponse MapToResponse(Course course) => Fill(new CourseResponse(), course);

    private static MyCourseResponse MapToMine(Course course, DateTime now, bool canReactivate)
    {
        var response = Fill(new MyCourseResponse(), course);
        response.Status = course.Status.ToString();
        response.PublishedAt = course.PublishedAt;
        response.ExpiresAt = course.ExpiresAt;
        response.DaysLeft = course.Status == CourseStatus.Approved && course.ExpiresAt is { } end
            ? Math.Max(0, (int)Math.Ceiling((end - now).TotalDays)) : null;
        response.HasPendingRevision = course.PendingRevision is not null;
        response.PendingRevision = RevisionView(course.PendingRevision);
        response.CanReactivate = course.Status == CourseStatus.Expired && canReactivate;
        return response;
    }

    /// <summary>Canlı (saytda görünən) məzmunun eyni forma görünüşü — admin redaktə formasını bununla doldurur.</summary>
    internal static CourseRevisionResponse ContentView(Course c) => new()
    {
        InstructorName = c.InstructorName, InstructorRole = c.InstructorRole, InstructorCompany = c.InstructorCompany,
        InstructorPhotoUrl = c.InstructorPhotoUrl, LinkedInUrl = c.LinkedInUrl, GitHubUrl = c.GitHubUrl,
        ContactEmail = c.ContactEmail, ContactPhone = c.ContactPhone, CourseTitle = c.CourseTitle, Kicker = c.Kicker,
        Description = c.Description, Duration = c.Duration, Level = c.Level, Language = c.Language,
        SyllabusTopics = c.SyllabusTopics, SyllabusFileUrl = c.SyllabusFileUrl, AccentColor = c.AccentColor,
        SubmittedAt = c.UpdatedAt ?? c.CreatedAt
    };

    /// <summary>Gözləyən redaktənin görünüşü — sahib və admin üçün eyni (AdminService də istifadə edir).</summary>
    internal static CourseRevisionResponse? RevisionView(CourseRevision? r) => r is null ? null : new()
    {
        InstructorName = r.InstructorName, InstructorRole = r.InstructorRole, InstructorCompany = r.InstructorCompany,
        InstructorPhotoUrl = r.InstructorPhotoUrl, LinkedInUrl = r.LinkedInUrl, GitHubUrl = r.GitHubUrl,
        ContactEmail = r.ContactEmail, ContactPhone = r.ContactPhone, CourseTitle = r.CourseTitle, Kicker = r.Kicker,
        Description = r.Description, Duration = r.Duration, Level = r.Level, Language = r.Language,
        SyllabusTopics = r.SyllabusTopics, SyllabusFileUrl = r.SyllabusFileUrl, AccentColor = r.AccentColor,
        SubmittedAt = r.SubmittedAt
    };

    private static T Fill<T>(T response, Course course) where T : CourseResponse
    {
        var initials = string.Join("",
            course.InstructorName.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(p => char.ToUpper(p[0])));
        response.Id                 = course.Id;
        response.InstructorName     = course.InstructorName;
        response.InstructorInitials = initials.Length > 2 ? initials[..2] : initials;
        response.InstructorRole     = course.InstructorRole;
        response.InstructorCompany  = course.InstructorCompany;
        response.InstructorPhotoUrl = course.InstructorPhotoUrl;
        response.LinkedInUrl        = course.LinkedInUrl;
        response.GitHubUrl          = course.GitHubUrl;
        response.ContactEmail       = course.ContactEmail;
        response.ContactPhone       = course.ContactPhone;
        response.CourseTitle        = course.CourseTitle;
        response.Kicker             = course.Kicker;
        response.Description        = course.Description;
        response.Duration           = course.Duration;
        response.Level              = course.Level;
        response.Language           = course.Language;
        response.SyllabusTopics     = course.SyllabusTopics;
        response.SyllabusFileUrl    = course.SyllabusFileUrl;
        response.AccentColor        = course.AccentColor;
        response.CreatedAt          = course.CreatedAt;
        return response;
    }
}
