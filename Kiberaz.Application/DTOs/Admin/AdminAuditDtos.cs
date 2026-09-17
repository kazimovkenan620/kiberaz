namespace Kiberaz.Application.DTOs.Admin;

/// <summary>Admin əməliyyat jurnalının bir sətri (yalnız Admin görür).</summary>
public class AdminAuditResponse
{
    public int      Id            { get; set; }
    public string   ActorNickname { get; set; } = string.Empty;
    public string   Action        { get; set; } = string.Empty;
    public string   TargetType    { get; set; } = string.Empty;
    public string?  TargetId      { get; set; }
    public string   Summary       { get; set; } = string.Empty;
    public string?  Ip            { get; set; }
    public DateTime At            { get; set; }
}

/// <summary>Jurnala yazılacaq bir qeyd — controller doldurur, servis saxlayır.</summary>
public sealed record AuditRecord(string ActorId, string Action, string TargetType, string? TargetId, string Summary, string? Ip);
