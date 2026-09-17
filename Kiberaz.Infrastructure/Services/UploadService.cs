using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace Kiberaz.Infrastructure.Services;

// Fayl yükləmə və sillabus endirmə.
//  • Yükləmə: uzantı + magic bytes + real bayt limiti + PDF sanitizasiyası (ayrıca prosesdə) + GUID ad.
//  • Kvota: hesab başına 24 saatlıq say/bayt (UploadPolicy) + qlobal say/bayt/boş disk (konfiqurasiya).
//  • Qeyd: hər fayl UploadedFiles-a yazılır (sahib, ölçü, sanitizasiya bayrağı); təlimə bağlanmayan fayl
//    UploadSweeper tərəfindən TTL-dən sonra silinir.
//  • Endirmə: artıq təmizlənmiş fayl birbaşa oxunur (qapısız, paylaşılan oxu); yalnız köhnə, qeydsiz PDF
//    ilk dəfə təmizlənib yerində əvəz olunur — hər endirmədə yeni proses yaradılmır.
public class UploadService(IWebHostEnvironment environment, IConfiguration configuration, PdfProcessSanitizer sanitizer,
    LiteDbContext db, TimeProvider clock) : IUploadService
{
    private string Root => Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads");
    private const long PdfReadLimit = 10 * 1024 * 1024;

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName,
        string[] allowedExtensions, long maxSizeBytes, string ownerId)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension) || folderName is not ("photos" or "syllabus"))
            throw new ArgumentException("Fayl formatı düzgün deyil.");
        if (maxSizeBytes is <= 0 or > PdfReadLimit)
            throw new ArgumentException("Fayl ölçüsü düzgün deyil.");
        if (string.IsNullOrWhiteSpace(ownerId))
            throw new ArgumentException("Yükləmə üçün hesab tələb olunur.");

        var now = clock.GetUtcNow().UtcDateTime;
        var (dailyFiles, dailyBytes) = DailyUsage(ownerId, now);
        if (dailyFiles >= UploadPolicy.PerUserDailyFiles)
            throw new UploadQuotaException("Günlük yükləmə limiti dolub. 24 saat sonra yenidən cəhd edin.");

        Directory.CreateDirectory(Root);
        using var gate = AcquireGate();
        var maxBytes = configuration.GetValue<long?>("Uploads:MaxTotalBytes") ?? 1024L * 1024 * 1024;
        var maxFiles = configuration.GetValue<int?>("Uploads:MaxFiles") ?? 2000;
        var reserve = configuration.GetValue<long?>("Uploads:MinFreeBytes") ?? 2L * 1024 * 1024 * 1024;
        if (maxBytes <= 0 || maxFiles <= 0 || reserve < 0)
            throw new InvalidOperationException("Upload limits must be positive.");
        long usedBytes = 0;
        var fileCount = 0;
        foreach (var file in new DirectoryInfo(Root).EnumerateFiles("*", SearchOption.AllDirectories))
        {
            if (file.FullName == Path.Combine(Root, ".upload-write.lock")) continue;
            usedBytes = checked(usedBytes + file.Length);
            if (++fileCount >= maxFiles || usedBytes > maxBytes - maxSizeBytes) throw new UploadCapacityException();
        }
        if (usedBytes > maxBytes - maxSizeBytes ||
            new DriveInfo(Path.GetPathRoot(Path.GetFullPath(Root))!).AvailableFreeSpace < reserve + maxSizeBytes)
            throw new UploadCapacityException();

        using var input = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await fileStream.ReadAsync(buffer)) != 0)
        {
            if (input.Length + read > maxSizeBytes) throw new ArgumentException("Fayl çox böyükdür.");
            input.Write(buffer, 0, read);
        }
        var bytes = input.ToArray();
        if (bytes.Length == 0) throw new ArgumentException("Fayl boş ola bilməz.");
        if (dailyBytes + bytes.Length > UploadPolicy.PerUserDailyBytes)
            throw new UploadQuotaException("Günlük yükləmə həcmi limiti dolub. 24 saat sonra yenidən cəhd edin.");
        ValidateSignature(bytes, extension);
        if (extension == ".pdf") bytes = await sanitizer.RewriteAsync(bytes, maxSizeBytes);

        var folder = Path.Combine(Root, folderName);
        Directory.CreateDirectory(folder);
        var name = Guid.NewGuid().ToString("N") + extension;
        var path = Path.Combine(folder, name);
        var url = $"/uploads/{folderName}/{name}";
        try
        {
            using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                await output.WriteAsync(bytes);
            db.UploadedFiles.Insert(new UploadedFile
            {
                OwnerId = ownerId, Path = url, Folder = folderName, Bytes = bytes.Length,
                CreatedAt = now, Sanitized = true
            });
        }
        catch
        {
            if (File.Exists(path)) File.Delete(path); // Only this operation's new file.
            throw;
        }
        return url;
    }

    private (int Files, long Bytes) DailyUsage(string ownerId, DateTime now)
    {
        var since = now - TimeSpan.FromHours(24);
        int files = 0; long bytes = 0;
        foreach (var record in db.UploadedFiles.Find(f => f.OwnerId == ownerId))
        {
            if (record.CreatedAt < since) continue;
            files++;
            bytes += record.Bytes;
        }
        return (files, bytes);
    }

    private FileStream AcquireGate()
    {
        var lockPath = Path.Combine(Root, ".upload-write.lock");
        try { return new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { throw new UploadCapacityException(); }
    }

    public async Task<byte[]> ReadSafePdfAsync(string fileName)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(fileName,
                @"\A(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})\.pdf\z"))
            throw new FileNotFoundException();
        var url = "/uploads/syllabus/" + fileName;
        var path = Path.Combine(Root, "syllabus", fileName);

        var record = db.UploadedFiles.FindOne(f => f.Path == url);
        if (record is { Sanitized: true })
        {
            // Yüklənərkən artıq təmizlənib, adı GUID-dir, kənardan dəyişmir — birbaşa, paylaşılan oxu.
            using var direct = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (direct.Length > PdfReadLimit) throw new ArgumentException("Fayl çox böyükdür.");
            using var copy = new MemoryStream();
            await direct.CopyToAsync(copy);
            return copy.ToArray();
        }

        // Köhnə (qeydsiz) fayl: bir dəfə təmizlənib yerində əvəz olunur, sonra həmişə birbaşa oxunur.
        byte[] input;
        using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (stream.Length > PdfReadLimit) throw new ArgumentException("Fayl çox böyükdür.");
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer);
            input = buffer.ToArray();
        }
        var sanitized = await sanitizer.RewriteAsync(input, PdfReadLimit);

        using var gate = AcquireGate();
        var temp = path + ".tmp";
        try
        {
            using (var output = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
                await output.WriteAsync(sanitized);
            File.Move(temp, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }

        var now = clock.GetUtcNow().UtcDateTime;
        record = db.UploadedFiles.FindOne(f => f.Path == url); // qapı altında təzə oxu — paralel ilk endirmə
        if (record is null)
        {
            var owner = db.Courses.Find(c => !c.IsDeleted)
                .FirstOrDefault(c => c.SyllabusFileUrl == url || c.PendingRevision?.SyllabusFileUrl == url);
            db.UploadedFiles.Insert(new UploadedFile
            {
                OwnerId = owner?.SubmittedByUserId ?? string.Empty, Path = url, Folder = "syllabus",
                Bytes = sanitized.Length, CreatedAt = now, Sanitized = true, ClaimedByCourseId = owner?.Id
            });
        }
        else
        {
            record.Sanitized = true;
            record.Bytes = sanitized.Length;
            db.UploadedFiles.Update(record);
        }
        return sanitized;
    }

    private static void ValidateSignature(byte[] bytes, string extension)
    {
        var valid = extension switch
        {
            ".pdf" => bytes.AsSpan().StartsWith("%PDF-"u8),
            ".png" => bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            ".jpg" or ".jpeg" => bytes.AsSpan().StartsWith(new byte[] { 255, 216, 255 }),
            ".webp" => bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8),
            _ => false
        };
        if (!valid) throw new ArgumentException("Fayl məzmunu formatla uyğun gəlmir.");
    }
}

public sealed class UploadCapacityException : Exception
{
    public UploadCapacityException() : base("Yükləmə xidməti hazırda doludur. Bir az sonra yenidən yoxlayın.") { }
}

// Hesab başına günlük kvota dolub — 429, Retry-After ilə.
public sealed class UploadQuotaException(string message) : Exception(message);
