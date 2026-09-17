using Kiberaz.Application.DTOs.Admin;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Admin əməliyyat jurnalı. Yazı append-only-dir; oxu yalnız Admin endpoint-indən.
/// Jurnal yazısının uğursuzluğu əsas əməliyyatı geri qaytarmır — lakin səssiz udulmur,
/// ExceptionMiddleware-ə çatıb loglanır.
/// </summary>
public interface IAuditLog
{
    Task RecordAsync(AuditRecord record);

    /// <summary>Ən yeni qeydlər. Axtarış əməliyyat kodu, hədəf və izah üzrə.</summary>
    Task<List<AdminAuditResponse>> GetRecentAsync(int take = 50, string? search = null);
}
