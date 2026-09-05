namespace Kiberaz.Application.DTOs.Admin;

/// <summary>
/// Admin dashboard-un yuxarı statistika kartları.
/// Bütün rəqəmlər canlı bazadan hesablanır — sabit dəyər yoxdur.
/// </summary>
public class AdminStatsResponse
{
    public int TotalUsers        { get; set; }
    public int TotalCourses      { get; set; }
    public int PendingCourses    { get; set; }
    public int ActiveExams       { get; set; }
    public int TotalExams        { get; set; }
    public int NewUsersThisWeek  { get; set; }
}

/// <summary>Admin panelindəki təlim sətri.</summary>
public class AdminCourseResponse
{
    public int      Id         { get; set; }
    public string   Title      { get; set; } = string.Empty;
    public string   Instructor { get; set; } = string.Empty;
    public string   Category   { get; set; } = string.Empty;

    /// <summary>"Approved" | "Pending" | "Rejected" — frontend bu sətirləri gözləyir.</summary>
    public string   Status     { get; set; } = string.Empty;

    /// <summary>ISO tarix (yyyy-MM-dd) — frontend birbaşa göstərir.</summary>
    public string   CreatedAt  { get; set; } = string.Empty;

    public string?  Link       { get; set; }
}

/// <summary>Admin panelindəki istifadəçi sətri.</summary>
public class AdminUserResponse
{
    public string       Id               { get; set; } = string.Empty;
    public string       Nickname         { get; set; } = string.Empty;
    public string       FirstName        { get; set; } = string.Empty;
    public string       LastName         { get; set; } = string.Empty;
    public string       Email            { get; set; } = string.Empty;
    public List<string> Roles            { get; set; } = new();
    public bool         IsEmailConfirmed { get; set; }
    public bool         IsBlocked        { get; set; }
    public string       JoinDate         { get; set; } = string.Empty;
}

/// <summary>
/// Admin panelindəki "imtahan" sətri.
///
/// QEYD: Platformada ayrıca Exam entity-si YOXDUR. Buradakı hər sətir bir quiz
/// kateqoriyasıdır — istifadəçilər məhz kateqoriyalar üzrə test həll edir.
/// StudentCount uydurma deyil: həmin kateqoriyada cavab vermiş unikal istifadəçi sayıdır.
/// </summary>
public class AdminExamResponse
{
    public string Id           { get; set; } = string.Empty;
    public string Title        { get; set; } = string.Empty;
    public string Instructor   { get; set; } = string.Empty;
    public int    StudentCount { get; set; }
    public string Duration     { get; set; } = string.Empty;

    /// <summary>"Aktiv" | "Gözlənilir" | "Tamamlandı"</summary>
    public string Status       { get; set; } = string.Empty;

    public string Category     { get; set; } = string.Empty;
    public string CreatedAt    { get; set; } = string.Empty;
}

/// <summary>Admin panelindən əl ilə təlim əlavə etmə sorğusu.</summary>
public class CreateAdminCourseRequest
{
    public string  Title      { get; set; } = string.Empty;
    public string  Instructor { get; set; } = string.Empty;
    public string  Category   { get; set; } = string.Empty;
    public string? Link       { get; set; }
}

/// <summary>İstifadəçinin rolunu dəyişmə sorğusu (admin tərəfindən).</summary>
public class AdminChangeUserRoleRequest
{
    public string Role { get; set; } = string.Empty;
}
