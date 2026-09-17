using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.DTOs.Admin;

/// <summary>
/// Admin İcmal bölməsinin göstəriciləri.
/// Bütün rəqəmlər canlı bazadan hesablanır — sabit dəyər yoxdur.
/// Sistem administratoru (gizli hesab) heç bir istifadəçi sayında iştirak etmir.
/// </summary>
public class AdminStatsResponse
{
    // ── İstifadəçilər ──
    public int TotalUsers        { get; set; }
    public int NewUsersThisWeek  { get; set; }
    public int BlockedUsers      { get; set; }
    public int UnconfirmedUsers  { get; set; }

    /// <summary>Rol üzrə bölgü: açar rol adı ("VIP", "Teacher", ...), dəyər say.</summary>
    public Dictionary<string, int> UsersByRole { get; set; } = new();

    /// <summary>Hazırda aktiv VIP dövrü olan hesab sayı.</summary>
    public int ActiveVipTerms    { get; set; }

    // ── Təlimlər ──
    public int TotalCourses      { get; set; }
    /// <summary>Moderasiya növbəsi: yeni/yenidən aktivləşdirmə sorğuları + gözləyən redaktələr.</summary>
    public int PendingCourses    { get; set; }
    public int ActiveCourses     { get; set; }
    public int ExpiredCourses    { get; set; }
    public int RejectedCourses   { get; set; }
    /// <summary>7 gün ərzində aktiv müddəti bitəcək təsdiqli təlimlər.</summary>
    public int ExpiringSoon      { get; set; }

    // ── Sual bankı ──
    public int TotalCategories   { get; set; }
    public int TotalQuestions    { get; set; }
    public int PublicQuestions   { get; set; }
    public int ExamOnlyQuestions { get; set; }

    // ── İmtahan sessiyaları ──
    public int TotalExamSessions    { get; set; }
    public int OpenExamSessions     { get; set; }
    public int ClosedExamSessions   { get; set; }
    public int TotalExamAttempts    { get; set; }
    public int SubmittedAttempts    { get; set; }

    // ── Quiz fəallığı ──
    public int TotalAnswers        { get; set; }
    public int CorrectAnswers      { get; set; }
    public int AnswersThisWeek     { get; set; }
}

/// <summary>Admin panelindəki təlim sətri.</summary>
public class AdminCourseResponse
{
    public int      Id         { get; set; }
    public string   Title      { get; set; } = string.Empty;
    public string   Instructor { get; set; } = string.Empty;
    public string   Category   { get; set; } = string.Empty;

    /// <summary>"Approved" | "Pending" | "Rejected" | "Expired" — frontend bu sətirləri gözləyir.</summary>
    public string   Status     { get; set; } = string.Empty;

    /// <summary>ISO tarix (yyyy-MM-dd) — frontend birbaşa göstərir.</summary>
    public string   CreatedAt  { get; set; } = string.Empty;

    public string?  Link       { get; set; }

    /// <summary>Sahibin (VIP) ləqəbi; admin panelindən əlavə edilən təlimlərdə null.</summary>
    public string?  OwnerNickname { get; set; }

    /// <summary>Sahibin hesab Id-si — admin istifadəçi kartına keçid üçün.</summary>
    public string?  OwnerId    { get; set; }

    /// <summary>Cari nəşrin təsdiq və bitmə anı (UTC ISO). null = müddətsiz / hələ nəşr olunmayıb.</summary>
    public DateTime? PublishedAt { get; set; }
    public DateTime? ExpiresAt   { get; set; }

    /// <summary>Sahibin göndərdiyi, admin təsdiqi gözləyən redaktə (varsa).</summary>
    public CourseRevisionResponse? PendingRevision { get; set; }

    /// <summary>Yenidən aktivləşdirmə sorğusudur (əvvəl nəşr olunub, indi yenidən Pending).</summary>
    public bool IsReactivation { get; set; }

    /// <summary>Saytda görünən cari məzmun — admin redaktə formasını bununla doldurur.</summary>
    public CourseRevisionResponse? Content { get; set; }
}

/// <summary>Admin panelindəki istifadəçi sətri (cədvəl üçün yüngül proyeksiya).</summary>
public class AdminUserResponse
{
    public string       Id               { get; set; } = string.Empty;
    public string       Nickname         { get; set; } = string.Empty;
    public string       FirstName        { get; set; } = string.Empty;
    public string       LastName         { get; set; } = string.Empty;
    public string       Email            { get; set; } = string.Empty;
    public List<string> Roles            { get; set; } = new();
    public bool         IsEmailConfirmed { get; set; }
    /// <summary>Admin tərəfindən bloklanıb (BlockedByAdminAt). Brute-force kilidi buraya daxil deyil.</summary>
    public bool         IsBlocked        { get; set; }
    /// <summary>Uğursuz giriş cəhdlərinə görə müvəqqəti (5 dəq) kilidlidir; öz-özünə açılır.</summary>
    public bool         IsTemporarilyLocked { get; set; }
    public string       JoinDate         { get; set; } = string.Empty;

    /// <summary>Aktiv VIP dövrünün sonu (UTC ISO); aktiv dövr yoxdursa null.</summary>
    public DateTime?    VipTermEndsAt    { get; set; }

    /// <summary>Aktiv dövrdə qalan təlim krediti; aktiv dövr yoxdursa null.</summary>
    public int?         VipCoursesRemaining { get; set; }
}

/// <summary>
/// Bir istifadəçinin tam kartı — admin "Bax" düyməsi ilə açır.
/// E-poçt və fəaliyyət göstəriciləri var: bu proyeksiya YALNIZ Admin roluna qaytarılır.
/// </summary>
public class AdminUserDetailResponse : AdminUserResponse
{
    /// <summary>1 = Kişi, 2 = Qadın, 0 = təyin edilməyib.</summary>
    public int        Gender          { get; set; }
    public string?    ProfileImageUrl { get; set; }

    /// <summary>Təsdiq gözləyən yeni e-poçt (istifadəçi dəyişiklik başladıbsa).</summary>
    public string?    PendingNewEmail { get; set; }

    /// <summary>Blok bitmə anı — sonsuz blokda uzaq gələcək tarix olur.</summary>
    public DateTimeOffset? LockoutEnd  { get; set; }
    public int        FailedAttempts  { get; set; }
    public DateTime   CreatedAt       { get; set; }

    // ── VIP ──
    public bool       HasActiveVipTerm { get; set; }
    public DateTime?  VipTermStartsAt  { get; set; }
    public int        VipCourseAllowance { get; set; }
    public int        VipCoursesUsed     { get; set; }
    /// <summary>Bu hesabın bütün VIP dövrlərinin sayı (tarixçə).</summary>
    public int        VipTermCount     { get; set; }

    // ── Fəaliyyət ──
    public int        CourseCount        { get; set; }
    public int        ActiveCourseCount  { get; set; }
    public int        ExamSessionCount   { get; set; }
    public int        ExamAttemptCount   { get; set; }
    public int        TeacherClassCount  { get; set; }
    public int        AnsweredQuestions  { get; set; }
    public int        CorrectAnswers     { get; set; }
    /// <summary>Son quiz cavabının tarixi — "son fəallıq" göstəricisi.</summary>
    public DateTime?  LastActivityAt     { get; set; }
}

/// <summary>Admin tərəfindən istifadəçi məlumatlarının düzəlişi (ad, soyad, ləqəb, cins).</summary>
public class AdminUpdateUserRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName  { get; set; } = string.Empty;
    public string Nickname  { get; set; } = string.Empty;

    /// <summary>1 = Kişi, 2 = Qadın.</summary>
    public int    Gender    { get; set; }

    /// <summary>E-poçt təsdiqini əl ilə vermək (istifadəçi məktubu ala bilmirsə).</summary>
    public bool   ConfirmEmail { get; set; }
}

/// <summary>Admin panelindəki imtahan sessiyası sətri (real ExamSession qeydi).</summary>
public class AdminExamSessionResponse
{
    public string   Id              { get; set; } = string.Empty;
    public string   Code            { get; set; } = string.Empty;
    public string   Title           { get; set; } = string.Empty;

    /// <summary>Sessiyanı yaradan (VIP) hesabın ləqəbi və Id-si.</summary>
    public string   HostName        { get; set; } = string.Empty;
    public string?  HostId          { get; set; }

    public int      DurationMinutes { get; set; }
    public int      QuestionCount   { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime? ClosedAt       { get; set; }

    /// <summary>"Aktiv" | "Bağlı" — frontend bu sətirləri gözləyir.</summary>
    public string   Status          { get; set; } = string.Empty;

    public int      ParticipantCount { get; set; }
    public int      SubmittedCount   { get; set; }
    /// <summary>Göndərilmiş cəhdlərin orta faizi; göndərən yoxdursa null.</summary>
    public decimal? AverageScore     { get; set; }
}

/// <summary>Sessiyanın bir iştirakçısının nəticəsi (admin görünüşü).</summary>
public class AdminExamParticipantResponse
{
    public string    Id           { get; set; } = string.Empty;
    public string    StudentId    { get; set; } = string.Empty;
    public string    Name         { get; set; } = string.Empty;
    public string?   Email        { get; set; }
    public DateTime  StartedAt    { get; set; }
    public DateTime? SubmittedAt  { get; set; }
    public int       AnsweredCount { get; set; }
    public int?      CorrectCount  { get; set; }
    public decimal?  Percentage    { get; set; }
}

/// <summary>Sessiya + iştirakçı nəticələri — admin "Nəticələr" pəncərəsi və CSV arxivi üçün.</summary>
public class AdminExamSessionDetailResponse
{
    public AdminExamSessionResponse Session { get; set; } = new();
    public List<AdminExamParticipantResponse> Participants { get; set; } = new();
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
