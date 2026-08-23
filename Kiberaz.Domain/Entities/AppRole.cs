namespace Kiberaz.Domain.Entities;

/// <summary>
/// Platformanın rol entity-si.
///
/// Əvvəl: IdentityRole istifadə edirdik (EF Core ilə gəlirdi)
/// İndi: Öz AppRole sinifimiz — LiteDB-də saxlanır
///
/// NOT: [BsonId] attribute-u Domain layer-ə LiteDB asılılığı gətirməmək üçün
/// LiteDbContext-dəki BsonMapper vasitəsilə konfiqurasiya edilir.
///
/// Rollar: Admin, Moderator, VIP, User, Teacher
/// (AppRoles.cs-dəki sabitlərə bax)
/// </summary>
public class AppRole
{
    /// <summary>
    /// LiteDB primary key. BsonMapper-də Id → _id kimi qeydiyyata alınıb.
    /// Dəyər: GUID string (məs: "f3a2b1c0-...")
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>Rolun adı (məs: "Admin")</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Rolun normallaşdırılmış adı — axtarış üçün.
    /// Həmişə BÖYÜK hərflə saxlanır: "ADMIN", "USER", ...
    /// </summary>
    public string NormalizedName { get; set; } = string.Empty;

    /// <summary>Concurrent dəyişiklik nəzarəti üçün damğa.</summary>
    public string? ConcurrencyStamp { get; set; } = Guid.NewGuid().ToString();
}
