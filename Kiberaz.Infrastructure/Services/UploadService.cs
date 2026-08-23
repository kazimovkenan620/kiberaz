using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Təhlükəsiz fayl yükləmə (File Upload) servisinin implementasiyası.
/// Faylları fiziki olaraq serverin diskində (wwwroot/uploads) saxlayır və təhlükəsizlik qaydalarına riayət edir.
/// </summary>
public class UploadService : IUploadService
{
    private readonly IWebHostEnvironment _webHostEnvironment;

    public UploadService(IWebHostEnvironment webHostEnvironment)
    {
        _webHostEnvironment = webHostEnvironment;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName, string[] allowedExtensions, long maxSizeBytes)
    {
        // 1. Faylın boş olub-olmadığını yoxlayırıq
        if (fileStream == null || fileStream.Length == 0)
        {
            throw new ArgumentException("Yüklənən fayl boş ola bilməz!");
        }

        // 2. Ölçü limitini yoxlayırıq
        if (fileStream.Length > maxSizeBytes)
        {
            double maxMb = (double)maxSizeBytes / (1024 * 1024);
            throw new ArgumentException($"Fayl çox böyükdür! Maksimum icazə verilən ölçü: {maxMb:F1} MB");
        }

        // 3. Uzantını (Extension) yoxlayırıq və təhlükəsizlik üçün kiçik hərflərə çeviririk
        var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(fileExtension))
        {
            var allowedList = string.Join(", ", allowedExtensions);
            throw new ArgumentException($"Yalnız bu formatlarda fayl yükləyə bilərsiniz: {allowedList}");
        }

        // 3b. Məzmun Yoxlanışı (Magic Number/Signature Validation)
        // Disguised (polyglot) faylları və şəkil daxilində gizlədilmiş scriptləri (EXIF/Metadata XSS) önləmək üçün imza yoxlanışı edirik
        ValidateFileSignature(fileStream, fileExtension);

        // 4. wwwroot qovluğunu təyin edirik
        var webRootPath = _webHostEnvironment.WebRootPath;
        if (string.IsNullOrEmpty(webRootPath))
        {
            // WebRootPath hələ yaradılmayıbsa, ContentRootPath daxilində wwwroot yaradırıq
            webRootPath = Path.Combine(_webHostEnvironment.ContentRootPath, "wwwroot");
        }

        // 5. Yükləmə qovluğunu yaradırıq (məs: wwwroot/uploads/photos)
        var uploadsFolder = Path.Combine(webRootPath, "uploads", folderName);
        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        // 6. Təhlükəsiz ad yaradırıq (GUID + uzantı)
        // Orijinal adı atırıq ki, Path Traversal və fayl adı toqquşması olmasın
        var secureFileName = $"{Guid.NewGuid()}{fileExtension}";
        var physicalPath = Path.Combine(uploadsFolder, secureFileName);

        // 7. Faylı fiziki olaraq diskə yazırıq
        using (var outputStream = new FileStream(physicalPath, FileMode.Create))
        {
            await fileStream.CopyToAsync(outputStream);
        }

        // 8. Brauzerdən əlçatan nisbi URL-i qaytarırıq (məs: /uploads/photos/guid.png)
        return $"/uploads/{folderName}/{secureFileName}";
    }

    /// <summary>
    /// Faylın daxili strukturunu (Magic Numbers) yoxlayır.
    /// Yalançı uzantı dəyişdirilməsi ilə zərərli kod yüklənməsinin (Polyglot / Web Shell) qarşısını alır.
    /// </summary>
    private void ValidateFileSignature(Stream fileStream, string extension)
    {
        if (!fileStream.CanSeek)
        {
            // Ehtiyat tədbiri: Əgər stream axtarışı dəstəkləmirsə, imzanı yoxlaya bilmirik
            return;
        }

        var currentPosition = fileStream.Position;
        fileStream.Position = 0;

        try
        {
            byte[] header = new byte[8];
            int bytesRead = fileStream.Read(header, 0, 8);
            if (bytesRead < 3) // JPEG üçün min 3 bayt, digərləri üçün min 4 bayt lazımdır
            {
                throw new ArgumentException("Yüklənən fayl etibarsız və ya zədəlidir.");
            }

            bool isValid = false;

            if (extension == ".png")
            {
                // PNG imza: 89 50 4E 47 0D 0A 1A 0A
                byte[] expected = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
                isValid = header.SequenceEqual(expected);
            }
            else if (extension == ".jpg" || extension == ".jpeg")
            {
                // JPEG imza: FF D8 FF
                isValid = header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
            }
            else if (extension == ".webp")
            {
                // WEBP imza: RIFF (ilk 4 bayt: 52 49 46 46)
                isValid = header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46;
            }
            else if (extension == ".pdf")
            {
                // PDF imza: %PDF (ilk 4 bayt: 25 50 44 46)
                isValid = header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46;
            }

            if (!isValid)
            {
                throw new ArgumentException($"Təhlükəsizlik Xətası! Fayl imzası uzantı ilə uyğun gəlmir. Fayl '{extension}' adlandırılsa da, daxili strukturu fərqlidir. Bu fayl zərərli kod ehtiva edə bilər!");
            }
        }
        finally
        {
            fileStream.Position = currentPosition;
        }
    }
}
