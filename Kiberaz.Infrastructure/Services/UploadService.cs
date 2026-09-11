using Kiberaz.Application.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace Kiberaz.Infrastructure.Services;

public class UploadService(IWebHostEnvironment environment, IConfiguration configuration, PdfProcessSanitizer sanitizer) : IUploadService
{
    private string Root => Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads");

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderName,
        string[] allowedExtensions, long maxSizeBytes)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(extension) || folderName is not ("photos" or "syllabus"))
            throw new ArgumentException("Fayl formatı düzgün deyil.");
        if (maxSizeBytes is <= 0 or > 10 * 1024 * 1024)
            throw new ArgumentException("Fayl ölçüsü düzgün deyil.");
        Directory.CreateDirectory(Root);
        // Cross-process lock held from quota check to final write; no waiting upload queue.
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

        // Bound actual bytes, including nonseekable and misleading-length streams.
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
        ValidateSignature(bytes, extension);
        if (extension == ".pdf") bytes = await sanitizer.RewriteAsync(bytes, maxSizeBytes);

        var folder = Path.Combine(Root, folderName);
        Directory.CreateDirectory(folder);
        var name = Guid.NewGuid().ToString("N") + extension;
        var path = Path.Combine(folder, name);
        try
        {
            using var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            await output.WriteAsync(bytes);
        }
        catch
        {
            if (File.Exists(path)) File.Delete(path); // Only this operation's new file.
            throw;
        }
        return $"/uploads/{folderName}/{name}";
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
        var path = Path.Combine(Root, "syllabus", fileName);
        using var gate = AcquireGate();
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        const long limit = 10 * 1024 * 1024;
        if (input.Length > limit) throw new ArgumentException("Fayl çox böyükdür.");
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer);
        // Existing files cannot bypass the parser through static hosting.
        return await sanitizer.RewriteAsync(buffer.ToArray(), limit);
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
