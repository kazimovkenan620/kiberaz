using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// LiteDB üzərində admin jurnalı. Aktor ləqəbi yazı anında bazadan götürülür ki, hesab sonradan
/// silinsə belə qeyddə kim olduğu qalsın. Yazı üçün kilid lazım deyil: qeydlər müstəqildir,
/// heç bir compare-and-write invariantı yoxdur.
/// </summary>
public sealed class AuditLog(LiteDbContext db, TimeProvider clock) : IAuditLog
{
    private const int MaxTake = 200;

    public Task RecordAsync(AuditRecord record)
    {
        var actor = db.Users.FindById(record.ActorId);
        db.AdminAudit.Insert(new AdminAuditEntry
        {
            ActorId       = record.ActorId,
            ActorNickname = actor?.Nickname ?? "—",
            Action        = record.Action,
            TargetType    = record.TargetType,
            TargetId      = record.TargetId,
            // İzah məhdudlaşdırılır — servis mesajı uzun olsa da jurnal şişmir.
            Summary       = record.Summary.Length > 300 ? record.Summary[..300] : record.Summary,
            Ip            = record.Ip,
            At            = clock.GetUtcNow().UtcDateTime
        });
        return Task.CompletedTask;
    }

    public Task<List<AdminAuditResponse>> GetRecentAsync(int take = 50, string? search = null)
    {
        var limit  = Math.Clamp(take, 1, MaxTake);
        var needle = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLowerInvariant();

        // `At` indeksi azalan sırada oxunur; axtarış varsa yaddaşda süzülüb ilk `limit` qeyd götürülür.
        var entries = db.AdminAudit.Query()
            .OrderByDescending(e => e.At)
            .ToEnumerable()
            .Where(e => needle is null ||
                        e.Action.ToLowerInvariant().Contains(needle) ||
                        e.TargetType.ToLowerInvariant().Contains(needle) ||
                        (e.TargetId?.ToLowerInvariant().Contains(needle) ?? false) ||
                        e.ActorNickname.ToLowerInvariant().Contains(needle) ||
                        e.Summary.ToLowerInvariant().Contains(needle))
            .Take(limit)
            .Select(e => new AdminAuditResponse
            {
                Id = e.Id, ActorNickname = e.ActorNickname, Action = e.Action, TargetType = e.TargetType,
                TargetId = e.TargetId, Summary = e.Summary, Ip = e.Ip, At = e.At
            })
            .ToList();

        return Task.FromResult(entries);
    }
}
