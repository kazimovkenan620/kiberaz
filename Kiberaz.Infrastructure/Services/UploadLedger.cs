using Kiberaz.Application.DTOs.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace Kiberaz.Infrastructure.Services;

// Yüklənmiş faylların təlimlərə bağlanması. Çağıran tərəf artıq VipSyncRoot + tranzaksiya altındadır
// (CourseService.Atomic / AdminService.CourseWrite) — burada kilid alınmır, await yoxdur.
public static class UploadLedger
{
    public static bool IsOwnUpload(string? url)
        => !string.IsNullOrWhiteSpace(url) && url.StartsWith("/uploads/", StringComparison.Ordinal);

    // Sorğuda göstərilən öz-yükləmə yolları həqiqətən bu istifadəçiyə aiddirmi?
    // Qeydsiz (köhnə) fayllar yoxlanıla bilmir — adı GUID olduğu üçün təxminlə tapılmır, buraxılır.
    public static void EnsureOwnedBy(LiteDbContext db, string userId, int? courseId, params string?[] urls)
    {
        foreach (var url in urls.Where(IsOwnUpload))
        {
            var record = db.UploadedFiles.FindOne(f => f.Path == url);
            if (record is null) continue;
            var ownedByCaller = string.Equals(record.OwnerId, userId, StringComparison.Ordinal);
            var alreadyOnThisCourse = courseId is not null && record.ClaimedByCourseId == courseId;
            if (!ownedByCaller && !alreadyOnThisCourse)
                throw new RequestFailedException(400, "Göstərilən fayl bu hesaba aid deyil. Faylı yenidən yükləyin.");
            if (record.ClaimedByCourseId is not null && record.ClaimedByCourseId != courseId)
                throw new RequestFailedException(400, "Bu fayl artıq başqa təlimdə istifadə olunur. Faylı yenidən yükləyin.");
        }
    }

    // Təlimin canlı + gözləyən məzmununun istinad etdiyi fayllar "bağlı", qalanları azad sayılır.
    // Silinmiş təlim heç nəyə bağlı qalmır — faylları TTL keçəndə süpürgə silir.
    public static void SyncClaims(LiteDbContext db, Course course, DateTime now)
    {
        var wanted = course.IsDeleted
            ? new HashSet<string>(StringComparer.Ordinal)
            : new[]
              {
                  course.InstructorPhotoUrl, course.SyllabusFileUrl,
                  course.PendingRevision?.InstructorPhotoUrl, course.PendingRevision?.SyllabusFileUrl
              }
              .Where(IsOwnUpload).Select(u => u!).ToHashSet(StringComparer.Ordinal);

        foreach (var record in db.UploadedFiles.Find(f => f.ClaimedByCourseId == course.Id).ToList())
        {
            if (wanted.Contains(record.Path)) continue;
            record.ClaimedByCourseId = null;
            record.ReleasedAt = now;
            db.UploadedFiles.Update(record);
        }

        foreach (var path in wanted)
        {
            var record = db.UploadedFiles.FindOne(f => f.Path == path);
            if (record is null || record.ClaimedByCourseId == course.Id) continue;
            if (record.ClaimedByCourseId is not null) continue; // başqa təlimə bağlıdır — EnsureOwnedBy artıq rədd edib
            record.ClaimedByCourseId = course.Id;
            record.ReleasedAt = null;
            db.UploadedFiles.Update(record);
        }
    }

    // Bir dəfəlik miqrasiya: UploadedFiles yaranmazdan əvvəl yüklənmiş və təlimlərdə istinad olunan fayllar
    // qeydə alınıb təlimə bağlanır ki, sahiblik yoxlaması işləsin və süpürgə onlara toxunmasın.
    // İdempotentdir — qeydi olan yol yenidən yazılmır.
    public static void Backfill(LiteDbContext db, string uploadsRoot, DateTime now, ILogger logger)
    {
        var added = 0;
        lock (db.VipSyncRoot)
        {
            foreach (var course in db.Courses.Find(c => !c.IsDeleted).ToList())
            {
                var paths = new[]
                {
                    course.InstructorPhotoUrl, course.SyllabusFileUrl,
                    course.PendingRevision?.InstructorPhotoUrl, course.PendingRevision?.SyllabusFileUrl
                }.Where(IsOwnUpload).Select(u => u!).Distinct(StringComparer.Ordinal);

                foreach (var url in paths)
                {
                    if (db.UploadedFiles.Exists(f => f.Path == url)) continue;
                    var parts = url.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length != 3 || parts[1] is not ("photos" or "syllabus")) continue;
                    var file = new FileInfo(Path.Combine(uploadsRoot, parts[1], parts[2]));
                    db.UploadedFiles.Insert(new UploadedFile
                    {
                        OwnerId = course.SubmittedByUserId ?? string.Empty, Path = url, Folder = parts[1],
                        Bytes = file.Exists ? file.Length : 0, CreatedAt = now,
                        // Köhnə PDF-lər yüklənərkən təmizlənməmiş ola bilər — ilk endirmədə təmizlənəcək.
                        Sanitized = parts[1] == "photos", ClaimedByCourseId = course.Id
                    });
                    added++;
                }
            }
        }
        if (added > 0)
            logger.LogWarning("Yükləmə qeydləri miqrasiyası: {Count} mövcud fayl təlimlərə bağlandı.", added);
    }
}
