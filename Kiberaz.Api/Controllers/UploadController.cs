using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Platformada fayl yükləmə (File Upload) əməliyyatlarını idarə edən controller.
/// Təhlükəsizlik üçün bütün yükləmələr üçün ciddi validasiyalar və limitlər tətbiq olunur.
/// CourseController.CreateCourse hər kəsə (AllowAnonymous) açıq olduğu üçün, kurs formundakı
/// şəkil/PDF yükləməsi də eyni şəkildə anonim istifadəçilərə açılır — əks halda daxil olmayan
/// istifadəçi faylı seçəndə 401 alır və bu, HeroSlider-də aldadıcı "server əlaqəsi" xətası kimi görünür.
/// "auth" rate-limit siyasəti CreateCourse ilə eyni cədvəldədir ki, anonim sui-istifadə məhdudlaşsın.
/// </summary>
[AllowAnonymous]
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
