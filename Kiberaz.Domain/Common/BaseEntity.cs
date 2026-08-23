namespace Kiberaz.Domain.Common;

// Bütün entity-lərin miras aldığı əsas sinif — Id, tarix və soft delete sahələri hər entity-də
// lazım olduğu üçün bir yerdə toplanıb, hər entity-də ayrıca yazmağa ehtiyac qalmır.
public abstract class BaseEntity
{
    // Verilənlər bazasında hər sətrin unikal nömrəsi; bazaya əlavə edildikdə avtomatik artırılır.
    public int Id { get; set; }

    // Obyekt ilk yaradılanda UTC vaxtı avtomatik yazılır — UTC istifadə edilir ki,
    // fərqli saat qurşaqlarında işləyən serverlər arasında uyğunsuzluq olmasın.
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Yalnız yeniləmə baş verdikdə doldurulur; başlanğıcda null qalır ki,
    // "dəyişdirilib" və ya "dəyişdirilməyib" fərqini ayırd etmək mümkün olsun.
    public DateTime? UpdatedAt { get; set; }

    // Məlumat faktiki olaraq bazadan silinmir — yalnız bu bayraq true olur.
    // Bu "soft delete" adlanır: köhnə data itmir, sadəcə sorğularda filtrlə göstərilmir.
    public bool IsDeleted { get; set; } = false;
}
