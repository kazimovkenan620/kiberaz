namespace Kiberaz.Domain.Entities;

/// <summary>
/// Müəllimin sinifi — tələbə siyahısı bu sənəddə EMBED edilib.
///
/// NOT: [BsonId] attribute-u Domain layer-ə LiteDB asılılığı gətirməmək üçün
/// LiteDbContext-dəki BsonMapper vasitəsilə konfiqurasiya edilir.
/// </summary>
public class TeacherClass
{
    /// <summary>
    /// LiteDB primary key. BsonMapper-də Id → _id kimi qeydiyyata alınıb.
    /// int auto-increment istifadə edirik.
    /// </summary>
    public int Id { get; set; }

    /// <summary>Sinifin adı (maks. 80 simvol)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Müəllim ID-si (AppUser.Id-ə reference)</summary>
    public string TeacherId { get; set; } = string.Empty;

    /// <summary>Sinifin yaradılma tarixi</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Sinifdəki tələbələr — EMBED edilib (ayrı collection yoxdur).
    /// SQL-dəki TeacherClassStudents join cədvəlinin NoSQL versiyası.
    /// </summary>
    public List<ClassStudent> Students { get; set; } = new();
}

/// <summary>
/// Sinifdəki tələbə — TeacherClass.Students siyahısında embed edilir.
/// </summary>
public class ClassStudent
{
    /// <summary>Tələbənin ID-si (AppUser.Id-ə reference)</summary>
    public string StudentId { get; set; } = string.Empty;

    /// <summary>Tələbənin sinfə əlavə edilmə tarixi</summary>
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}
