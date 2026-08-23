using System.IO;
using System.Threading.Tasks;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Platformada təhlükəsiz fayl yükləmə (File Upload) servisinin müqaviləsi.
/// Clean Architecture qaydalarına uyğun olaraq, Application layihəsi Microsoft.AspNetCore.Http (IFormFile)
/// asılılığı daşımır, bunun əvəzinə saf .NET Stream və fayl adı istifadə edir.
/// </summary>
public interface IUploadService
{
    /// <summary>
    /// Faylı Stream vasitəsilə təhlükəsiz şəkildə serverə yükləyir və URL-ni qaytarır.
    /// </summary>
    /// <param name="fileStream">Faylın data axını (stream)</param>
    /// <param name="fileName">Faylın adı (uzantısını yoxlamaq üçün)</param>
    /// <param name="folderName">wwwroot/uploads/ altında yerləşəcək alt qovluq (məs: "photos", "syllabus")</param>
    /// <param name="allowedExtensions">İcazə verilən uzantılar (məs: ['.jpg', '.png'])</param>
    /// <param name="maxSizeBytes">Maksimum icazə verilən fayl ölçüsü (bayt ilə)</param>
    /// <returns>Faylın brauzerdən əlçatan olan nisbi URL-i</returns>
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName, string[] allowedExtensions, long maxSizeBytes);
}
