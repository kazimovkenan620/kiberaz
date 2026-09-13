using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;
using Kiberaz.Infrastructure.Services;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Platformada fayl yükləmə (File Upload) əməliyyatlarını idarə edən controller.
/// Təhlükəsizlik üçün bütün yükləmələr üçün ciddi validasiyalar və limitlər tətbiq olunur.
/// GİRİŞ TƏLƏB OLUNUR. Əvvəl bütün controller [AllowAnonymous] idi, çünki təlim formu
/// anonim işləyirdi. Bu, kimliyi bilinməyən istifadəçiyə serverin diskinə fayl yazmaq
/// imkanı verirdi — həm disk doldurma (DoS), həm də zərərli məzmun yerləşdirmə vektoru,
/// üstəlik faylı kimin qoyduğunu müəyyən etmək mümkün deyildi.
/// CreateCourse indi giriş tələb etdiyi üçün yükləmənin anonim qalması üçün səbəb də qalmır.
///
/// İSTİSNA: DownloadPdf anonim qalır — sillabus public təlim səhifəsində göstərilir.
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("upload")]
public class UploadController : ControllerBase
{
    // Kestrel-in default request limiti 30 MB-dır — endpoint özü 2/10 MB qəbul etsə də,
    // bu limit olmadan server 30 MB-lıq gövdəni tam oxuyandan sonra rədd edir.
    // Aşağıdakı sabitlərlə sorğu HƏLƏ DİSKƏ YAZILMADAN, oxunma mərhələsində kəsilir.
    private const long PhotoRequestLimitBytes    = 3L  * 1024 * 1024;  // 2 MB fayl + multipart overhead
    private const long SyllabusRequestLimitBytes = 12L * 1024 * 1024;  // 10 MB fayl + multipart overhead

    private readonly IUploadService _uploadService;

    public UploadController(IUploadService uploadService)
    {
        _uploadService = uploadService;
    }

    // Public oxu: təlim sillabusu sayta girən hər kəsə göstərilir.
    [HttpGet("/uploads/syllabus/{fileName}")]
    [AllowAnonymous]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> DownloadPdf(string fileName)
    {
        try
        {
            var bytes = await _uploadService.ReadSafePdfAsync(fileName);
            Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
            Response.Headers["Cache-Control"] = "no-store";
            return File(bytes, "application/pdf", "syllabus.pdf");
        }
        catch (UploadCapacityException e) { return StatusCode(503, ApiResponse<object>.Fail(e.Message)); }
        catch (Exception e) when (e is ArgumentException or IOException) { return NotFound(); }
    }

    /// <summary>
    /// Müəllim şəklini yükləyir.
    /// Yalnız JPG, JPEG, PNG, WEBP formatları və max 2MB ölçü qəbul olunur.
    /// </summary>
    [HttpPost("photo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(PhotoRequestLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = PhotoRequestLimitBytes)]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<string>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ApiResponse<object>))]
    public async Task<IActionResult> UploadPhoto(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("Fayl seçilməyib və ya boşdur."));
        }

        try
        {
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            long maxSizeBytes = 2 * 1024 * 1024; // 2 MB

            using var stream = file.OpenReadStream();
            var fileUrl = await _uploadService.UploadFileAsync(stream, file.FileName, "photos", allowedExtensions, maxSizeBytes);
            
            return Ok(ApiResponse<string>.Ok(fileUrl, "Müəllim şəkli uğurla yükləndi."));
        }
        catch (UploadCapacityException ex) { return StatusCode(503, ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("Fayl yüklənərkən gözlənilməz xəta baş verdi."));
        }
    }

    /// <summary>
    /// Təlim sillabus PDF-ini yükləyir.
    /// Yalnız PDF formatı və max 10MB ölçü qəbul olunur.
    /// </summary>
    [HttpPost("syllabus")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(SyllabusRequestLimitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = SyllabusRequestLimitBytes)]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<string>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ApiResponse<object>))]
    public async Task<IActionResult> UploadSyllabus(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("Fayl seçilməyib və ya boşdur."));
        }

        try
        {
            var allowedExtensions = new[] { ".pdf" };
            long maxSizeBytes = 10 * 1024 * 1024; // 10 MB

            using var stream = file.OpenReadStream();
            var fileUrl = await _uploadService.UploadFileAsync(stream, file.FileName, "syllabus", allowedExtensions, maxSizeBytes);
            
            return Ok(ApiResponse<string>.Ok(fileUrl, "Təlim sillabusu uğurla yükləndi."));
        }
        catch (UploadCapacityException ex) { return StatusCode(503, ApiResponse<object>.Fail(ex.Message)); }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("Fayl yüklənərkən gözlənilməz xəta baş verdi."));
        }
    }
}
