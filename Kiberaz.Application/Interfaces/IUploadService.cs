using System.IO;
using System.Threading.Tasks;

namespace Kiberaz.Application.Interfaces;

public interface IUploadService
{
    /// <summary>Sillabus PDF-ini oxuyur; yalnız təmizlənmiş (SafePdf) məzmun qaytarır.</summary>
    Task<byte[]> ReadSafePdfAsync(string fileName);

    /// <summary>
    /// Faylı yoxlayıb (uzantı, magic bytes, ölçü, PDF sanitizasiyası) saxlayır və nisbi yolu qaytarır.
    /// <paramref name="ownerId"/> hesab başına günlük kvota və sahiblik qeydi üçündür.
    /// </summary>
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName,
        string[] allowedExtensions, long maxSizeBytes, string ownerId);
}
