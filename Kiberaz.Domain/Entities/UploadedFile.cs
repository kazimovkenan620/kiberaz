namespace Kiberaz.Domain.Entities;

// Yüklənmiş faylın sahibi və istifadə vəziyyəti. Təlimə bağlanmayan (ClaimedByCourseId == null) fayl
// UploadPolicy.OrphanTtl keçəndə süpürülür — sahibsiz fayllar qlobal kvotanı doldura bilməsin.
public class UploadedFile
{
    public int Id { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    // "/uploads/photos/<guid>.png" — controller-in qaytardığı nisbi yol; unikal indeks.
    public string Path { get; set; } = string.Empty;
    public string Folder { get; set; } = string.Empty;
    public long Bytes { get; set; }
    public DateTime CreatedAt { get; set; }
    // PDF-lər yüklənərkən SafePdf-dən keçir; köhnə (qeydsiz) fayllar ilk endirmədə təmizlənib bu bayraqla qeyd olunur.
    public bool Sanitized { get; set; }
    public int? ClaimedByCourseId { get; set; }
    // Təlim silinəndə/şəkil dəyişəndə fayl azad olur; süpürgə bu vaxtdan TTL sayır.
    public DateTime? ReleasedAt { get; set; }
}
