using Microsoft.AspNetCore.Identity;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.User;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

// Bu servis istifadəçi profilini, sinifləri və müəllim-tələbə əlaqələrini idarə edir.
// Autentifikasiya əməliyyatları buraya daxil deyil — o məsuliyyət AuthService-dədir.
public class UserService : IUserService
{
    private static readonly TimeSpan EmailChangeCooldown  = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PasswordResetCooldown = TimeSpan.FromSeconds(60);

    /// <summary>Bir sinifdə saxlanıla bilən maksimum tələbə sayı — cavab ölçüsü və hesablama yükü üçün sərhəd.</summary>
    private const int MaxStudentsPerClass = 200;

    private readonly UserManager<AppUser>   _userManager;
    private readonly LiteDbContext          _db;
    private readonly IEmailService          _emailService;
    private readonly ProtectedAccountPolicy _protected;

    // UserManager Identity sistemini, LiteDbContext isə sinif və quiz məlumatlarını idarə edir.
    // Bu iki fərqli yaddaş qatının (SQL + embedded LiteDB) birgə istifadəsi burada koordinasiya edilir.
    public UserService(
        UserManager<AppUser> userManager,
        LiteDbContext db,
        IEmailService emailService,
        ProtectedAccountPolicy protectedAccounts)
    {
        _userManager  = userManager;
        _db           = db;
        _emailService = emailService;
        _protected    = protectedAccounts;
    }

    /// <inheritdoc />
    public async Task<ApiResponse<ProfileResponse>> GetProfileAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<ProfileResponse>.Fail("İstifadəçi tapılmadı.");

        var roles = await _userManager.GetRolesAsync(user);
        return ApiResponse<ProfileResponse>.Ok(MapToProfile(user, roles));
    }

    /// <inheritdoc />
    public async Task<ApiResponse<ProfileResponse>> UpdateProfileAsync(string userId, UpdateProfileRequest request)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<ProfileResponse>.Fail("İstifadəçi tapılmadı.");

        var newNickname = request.Nickname.Trim();
        if (!string.Equals(user.Nickname, newNickname, StringComparison.OrdinalIgnoreCase))
        {
            var existingNickname = await _userManager.FindByNameAsync(newNickname);
            if (existingNickname is not null && existingNickname.Id != user.Id)
                return ApiResponse<ProfileResponse>.Fail("Bu nickname artıq istifadə olunur.");

            var usernameResult = await _userManager.SetUserNameAsync(user, newNickname);
            if (!usernameResult.Succeeded)
                return ApiResponse<ProfileResponse>.Fail(usernameResult.Errors.Select(e => e.Description).ToList());

            user.Nickname = newNickname;
        }

        user.FirstName = request.FirstName.Trim();
        user.LastName  = request.LastName.Trim();
        user.Gender    = (Gender)request.Gender;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return ApiResponse<ProfileResponse>.Fail(result.Errors.Select(e => e.Description).ToList());

        var roles = await _userManager.GetRolesAsync(user);
        return ApiResponse<ProfileResponse>.Ok(MapToProfile(user, roles), "Profil uğurla yeniləndi.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<bool>> RequestEmailChangeAsync(string userId, ChangeEmailRequest request)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        var newEmail = request.NewEmail.Trim();
        if (_protected.IsOwner(user))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);

        if (_protected.IsOwnerEmail(newEmail))
            return ApiResponse<bool>.Fail("Bu e-poçt sistem administratoruna aiddir.");

        if (string.IsNullOrWhiteSpace(newEmail) || !newEmail.Contains('@') || newEmail.Length > 100)
            return ApiResponse<bool>.Fail("Düzgün e-poçt daxil edin.");

        if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            return ApiResponse<bool>.Fail("Yeni e-poçt hazırkı e-poçtla eynidir.");

        var existing = await _userManager.FindByEmailAsync(newEmail);
        if (existing is not null && existing.Id != user.Id)
            return ApiResponse<bool>.Fail("Bu e-poçt artıq istifadə olunur.");

        // Cooldown yoxlanışı: eyni istifadəçi 60 saniyə ərzində təkrar sorğu göndərə bilməz.
        var now = DateTime.UtcNow;
        if (user.LastEmailChangeConfirmationSentAt is not null &&
            now - user.LastEmailChangeConfirmationSentAt.Value < EmailChangeCooldown)
            return ApiResponse<bool>.Ok(true, "E-poçt dəyişikliyi linki artıq göndərilib. 60 saniyə sonra yenidən yoxlayın.");

        if (string.IsNullOrWhiteSpace(user.Email) || !user.EmailConfirmed)
            return ApiResponse<bool>.Fail("E-poçtu dəyişmək üçün cari e-poçt təsdiqli olmalıdır.");

        var token = await _userManager.GenerateChangeEmailTokenAsync(user, newEmail);
        var emailResult = await _emailService.SendEmailChangeConfirmationAsync(user.Email, user.Id, newEmail, token);
        if (!emailResult.Success)
            return ApiResponse<bool>.Fail("Təsdiq e-poçtu göndərilə bilmədi.");

        user.PendingNewEmail = newEmail;
        user.LastEmailChangeConfirmationSentAt = now;
        await _userManager.UpdateAsync(user);
        return ApiResponse<bool>.Ok(true, "E-poçt dəyişikliyi linki cari e-poçt ünvanınıza göndərildi.");
    }

    public async Task<ApiResponse<bool>> ConfirmEmailChangeAsync(string userId, string newEmail, string token)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        var email = newEmail.Trim();
        if (_protected.IsOwner(user))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);

        if (_protected.IsOwnerEmail(email))
            return ApiResponse<bool>.Fail("Bu e-poçt sistem administratoruna aiddir.");

        // İDEMPOTENTLİK — eyni link iki dəfə açıldıqda.
        //
        // Bu endpoint bir dəfədən çox çağırıla bilər və bu, NORMAL haldır:
        //   • Gmail/Outlook və korporativ poçt filtrləri məktubdakı linkləri istifadəçi
        //     kliklədən ƏVVƏL yoxlamaq üçün açır (link prefetch);
        //   • istifadəçi səhifəni yeniləyir və ya iki dəfə klikləyir.
        // Belə hallarda dəyişiklik ARTIQ tətbiq olunub: PendingNewEmail təmizlənib,
        // Email isə hədəf ünvandır. Əvvəl bu vəziyyət "link etibarsızdır" kimi
        // göstərilirdi — yəni əməliyyat uğurlu olduğu halda istifadəçi xəta görürdü.
        var alreadyApplied =
            string.IsNullOrWhiteSpace(user.PendingNewEmail) &&
            string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);

        if (alreadyApplied)
            return ApiResponse<bool>.Ok(true, "E-poçt artıq dəyişdirilib. Yeni ünvana göndərilən linklə hesabı təsdiqləyin.");

        if (!string.Equals(user.PendingNewEmail, email, StringComparison.OrdinalIgnoreCase))
            return ApiResponse<bool>.Fail("E-poçt dəyişikliyi linki etibarsızdır.");

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null && existing.Id != user.Id)
            return ApiResponse<bool>.Fail("Bu e-poçt artıq istifadə olunur.");

        // ChangeEmailAsync commits EmailConfirmed=true. Verify the same Identity
        // token, then persist the entire unconfirmed state in ONE concurrency-checked write.
        if (!await _userManager.VerifyUserTokenAsync(user, _userManager.Options.Tokens.ChangeEmailTokenProvider,
                "ChangeEmail:" + email, token))
            return ApiResponse<bool>.Fail("E-poçt dəyişikliyi linki etibarsızdır.");
        user.Email = email;
        user.SecurityStamp = Guid.NewGuid().ToString();
        user.UserName  = user.Nickname;
        user.PendingNewEmail = null;
        user.EmailConfirmed  = false;
        user.RefreshToken    = null;
        user.RefreshTokenExpiryTime = null;
        user.GoogleLoginCodeHash = null;
        user.GoogleLoginCodeExpiryTime = null;
        user.GoogleLoginCodeSecurityStamp = null;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            // YARIŞI UDUZMA HALI.
            // İki eyni sorğu paralel gəldikdə hər ikisi eyni ConcurrencyStamp ilə oxuyur,
            // token yoxlamasından keçir, sonra biri yazır və stamp-i yeniləyir — ikincinin
            // yazısı isə köhnə stamp səbəbindən rədd olunur.
            //
            // Bu sorğu token yoxlamasını YUXARIDA keçib, yəni səlahiyyətli idi; sadəcə
            // yarışı uduzdu. Nəticə eyni olduğu üçün onu xəta kimi göstərmək yanlışdır —
            // istifadəçi "Hesab dəyişib" mesajı görürdü, halbuki e-poçt uğurla dəyişmişdi.
            var latest = await _userManager.FindByIdAsync(userId);
            if (latest is not null &&
                string.Equals(latest.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                return ApiResponse<bool>.Ok(true,
                    "E-poçt dəyişdirildi. Yeni ünvana göndərilən linklə hesabı yenidən təsdiqləyin.");
            }

            return ApiResponse<bool>.Fail("Hesab dəyişib. E-poçt dəyişikliyini yenidən başladın.");
        }

        var confirmationToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var confirmResult = await _emailService.SendConfirmationEmailAsync(email, user.Id, confirmationToken);
        if (!confirmResult.Success)
            return ApiResponse<bool>.Fail("E-poçt dəyişdirildi, amma yeni ünvana təsdiq linki göndərilə bilmədi.");

        return ApiResponse<bool>.Ok(true, "E-poçt dəyişdirildi. Yeni ünvana göndərilən linklə hesabı yenidən təsdiqləyin.");
    }

    public async Task<ApiResponse<bool>> RequestPasswordChangeAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        if (string.IsNullOrWhiteSpace(user.Email) || !user.EmailConfirmed)
            return ApiResponse<bool>.Fail("Parolu yeniləmək üçün e-poçt təsdiqli olmalıdır.");

        // 60 saniyəlik fasilə: eyni istifadəçi dalbadal parol sıfırlama linki tələb edə bilməz.
        var now = DateTime.UtcNow;
        if (user.LastPasswordResetEmailSentAt is not null &&
            now - user.LastPasswordResetEmailSentAt.Value < PasswordResetCooldown)
            return ApiResponse<bool>.Ok(true, "Şifrə yeniləmə linki artıq göndərilib. 60 saniyə sonra yenidən yoxlayın.");

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var emailResult = await _emailService.SendPasswordResetEmailAsync(user.Email, user.Id, token);
        if (!emailResult.Success)
            return ApiResponse<bool>.Fail("Şifrə yeniləmə e-poçtu göndərilə bilmədi.");

        user.LastPasswordResetEmailSentAt = now;
        await _userManager.UpdateAsync(user);
        return ApiResponse<bool>.Ok(true, "Şifrə yeniləmə linki e-poçtunuza göndərildi.");
    }

    /// <inheritdoc />
    public async Task<ApiResponse<StudentOverviewResponse>> GetMyOverviewAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<StudentOverviewResponse>.Fail("İstifadəçi tapılmadı.");

        // Hesablama müəllim görünüşü ilə eynidir — təkrar məntiq yazılmır.
        // ID token-dən gəlir, sorğudan yox: istifadəçi başqasının statistikasını çəkə bilməz.
        return ApiResponse<StudentOverviewResponse>.Ok(MapToStudentOverview(user));
    }

    public async Task<ApiResponse<StudentOverviewResponse>> GetStudentOverviewAsync(string teacherId, string studentId)
    {
        var teacher = await _userManager.FindByIdAsync(teacherId);
        if (teacher is null)
            return ApiResponse<StudentOverviewResponse>.Fail("Müəllim hesabı tapılmadı.");

        if (!await _userManager.IsInRoleAsync(teacher, AppRoles.Teacher))
            return ApiResponse<StudentOverviewResponse>.Fail("Bu bölmə yalnız müəllimlər üçündür.");

        var student = await _userManager.FindByIdAsync(studentId.Trim());
        if (student is null)
            return ApiResponse<StudentOverviewResponse>.Fail("Tələbə tapılmadı.");

        // Sistem administratoru tələbə kimi axtarıla bilməz və mövcudluğu sızmır —
        // cavab adi "tapılmadı" mesajı ilə eynidir.
        if (await _userManager.IsInRoleAsync(student, AppRoles.Teacher) ||
            ProtectedAccountPolicy.IsHiddenAccount(student))
            return ApiResponse<StudentOverviewResponse>.Fail("Daxil edilən ID tələbə hesabına aid deyil.");

        // LiteDB embedded collection-da Any() query-ni dəstəkləmir, memory-də yoxlayırıq.
        // Əvvəlcə Find() ilə müəllimin siniflərini gətiririk, sonra C#-da Any() çağırırıq.
        var canView = _db.TeacherClasses
            .Find(c => c.TeacherId == teacherId)
            .Any(c => c.Students.Any(s => s.StudentId == student.Id));

        if (!canView)
            return ApiResponse<StudentOverviewResponse>.Fail("Tələbə əvvəlcə müəllimin sinfinə əlavə edilməlidir.");

        return ApiResponse<StudentOverviewResponse>.Ok(MapToStudentOverview(student));
    }

    public async Task<ApiResponse<List<TeacherClassResponse>>> GetTeacherClassesAsync(string teacherId)
    {
        var teacherCheck = await EnsureTeacherAsync(teacherId);
        if (!teacherCheck.Success)
            return ApiResponse<List<TeacherClassResponse>>.Fail(teacherCheck.Error);

        var classes = _db.TeacherClasses
            .Find(c => c.TeacherId == teacherId)
            .OrderByDescending(c => c.CreatedAt)
            .ToList();

        var responses = new List<TeacherClassResponse>();
        foreach (var cls in classes)
        {
            var response = await MapToTeacherClassResponseAsync(cls);
            responses.Add(response);
        }

        return ApiResponse<List<TeacherClassResponse>>.Ok(responses);
    }

    public async Task<ApiResponse<TeacherClassResponse>> CreateTeacherClassAsync(
        string teacherId, CreateTeacherClassRequest request)
    {
        var teacherCheck = await EnsureTeacherAsync(teacherId);
        if (!teacherCheck.Success)
            return ApiResponse<TeacherClassResponse>.Fail(teacherCheck.Error);

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return ApiResponse<TeacherClassResponse>.Fail("Sinif adı daxil edin.");

        if (name.Length > 80)
            return ApiResponse<TeacherClassResponse>.Fail("Sinif adı maksimum 80 simvol ola bilər.");

        TeacherClass teacherClass;

        // YARIŞ ŞƏRAİTİ (race condition) qorunması.
        //
        // Yuxarıdakı EnsureTeacherAsync yoxlaması ilə aşağıdakı Insert arasında istifadəçi
        // paralel sorğu ilə rolunu "tələbə"yə keçirə bilər. ChangeRoleAsync o an sinif
        // görmədiyi üçün keçidə icazə verər, bu Insert isə ondan sonra işləyər —
        // nəticədə MÜƏLLİM OLMAYAN hesaba məxsus "yetim" sinif qalar: sahibi onu
        // GetTeacherClasses ilə görə bilməz (rol yoxdur), silə də bilməz.
        //
        // Həll: mövcudluq yoxlaması və Insert rol yoxlaması ilə birlikdə eyni kilid
        // altında aparılır — ChangeRoleAsync da məhz bu kilidi tutur, ona görə iki
        // əməliyyat bir-birini gözləyir və aralarında pəncərə qalmır.
        lock (_db.UsersSyncRoot)
        {
            var owner = _db.Users.FindById(teacherId);
            if (owner is null || !owner.Roles.Contains(AppRoles.Teacher))
                return ApiResponse<TeacherClassResponse>.Fail("Bu bölmə yalnız müəllimlər üçündür.");

            var exists = _db.TeacherClasses
                .Exists(c => c.TeacherId == teacherId && c.Name == name);
            if (exists)
                return ApiResponse<TeacherClassResponse>.Fail("Bu adda sinif artıq mövcuddur.");

            teacherClass = new TeacherClass
            {
                Name      = name,
                TeacherId = teacherId,
                CreatedAt = DateTime.UtcNow
            };

            _db.TeacherClasses.Insert(teacherClass);
        }

        var response = await MapToTeacherClassResponseAsync(teacherClass);
        return ApiResponse<TeacherClassResponse>.Ok(response, "Sinif yaradıldı.");
    }

    public async Task<ApiResponse<TeacherClassResponse>> AddStudentToClassAsync(
        string teacherId, int classId, AddStudentToClassRequest request)
    {
        var teacherCheck = await EnsureTeacherAsync(teacherId);
        if (!teacherCheck.Success)
            return ApiResponse<TeacherClassResponse>.Fail(teacherCheck.Error);

        var studentId = request.StudentId.Trim();
        if (string.IsNullOrWhiteSpace(studentId))
            return ApiResponse<TeacherClassResponse>.Fail("Tələbə ID-si daxil edin.");

        // Bütün asinxron yoxlamalar kiliddən ƏVVƏL bitir: LiteDB kilidini tutarkən `await`
        // etmək olmaz (tranzaksiya thread-ə bağlıdır).
        var student = await _userManager.FindByIdAsync(studentId);
        if (student is null)
            return ApiResponse<TeacherClassResponse>.Fail("Tələbə tapılmadı.");

        if (await _userManager.IsInRoleAsync(student, AppRoles.Teacher) ||
            ProtectedAccountPolicy.IsHiddenAccount(student))
            return ApiResponse<TeacherClassResponse>.Fail("Daxil edilən ID tələbə hesabına aid deyil.");

        TeacherClass teacherClass;

        // İTİRİLƏN YAZI (lost update) qorunması.
        //
        // LiteDB `Update` bütün sənədi əvəz edir. Sinif kiliddən kənarda oxunub dəyişdirilirdisə,
        // eyni sinfə paralel iki əlavə bir-birini üzürdü: ikinci yazı birincinin əlavə etdiyi
        // tələbəni siyahıdan silirdi və heç bir xəta görünmürdü.
        // İndi oxu → yoxla → yaz ardıcıllığı bütövlükdə eyni kilid altındadır.
        lock (_db.UsersSyncRoot)
        {
            var existing = _db.TeacherClasses
                .FindOne(c => c.Id == classId && c.TeacherId == teacherId);

            if (existing is null)
                return ApiResponse<TeacherClassResponse>.Fail("Sinif tapılmadı.");

            // LiteDB embedded collection-da unique constraint yoxdur, manual yoxlayırıq.
            if (existing.Students.Any(s => s.StudentId == student.Id))
                return ApiResponse<TeacherClassResponse>.Fail("Bu tələbə artıq sinifdədir.");

            // Sinif ölçüsü limitsiz idi: hər tələbə üçün ayrıca statistika hesablandığı üçün
            // böyük sinif həm cavabı, həm server yükünü şişirdirdi (imtahan sessiyasında
            // artıq 500 iştirakçı limiti var — eyni məntiq buraya da tətbiq olunur).
            if (existing.Students.Count >= MaxStudentsPerClass)
                return ApiResponse<TeacherClassResponse>.Fail(
                    $"Sinifdə maksimum {MaxStudentsPerClass} tələbə ola bilər.");

            existing.Students.Add(new ClassStudent
            {
                StudentId = student.Id,
                AddedAt   = DateTime.UtcNow
            });

            _db.TeacherClasses.Update(existing);
            teacherClass = existing;
        }

        var response = await MapToTeacherClassResponseAsync(teacherClass);
        return ApiResponse<TeacherClassResponse>.Ok(response, "Tələbə sinfə əlavə edildi.");
    }

    /// <summary>
    /// Müəllimin öz sinfini silir.
    ///
    /// Təhlükəsizlik: sinif TeacherId şərti ilə axtarılır — başqa müəllimin sinif ID-si
    /// göndərilsə nəticə "tapılmadı" olur, yəni IDOR bağlıdır və başqasının sinfinin
    /// mövcudluğu da sızmır.
    ///
    /// Sinif silindikdə içindəki tələbə qeydləri (embed edilmiş ClassStudent siyahısı) da gedir;
    /// tələbə HESABLARINA və onların nəticələrinə toxunulmur — yalnız sinfə bağlılıq silinir.
    /// </summary>
    public async Task<ApiResponse<bool>> DeleteTeacherClassAsync(string teacherId, int classId)
    {
        var teacherCheck = await EnsureTeacherAsync(teacherId);
        if (!teacherCheck.Success)
            return ApiResponse<bool>.Fail(teacherCheck.Error);

        var teacherClass = _db.TeacherClasses
            .FindOne(c => c.Id == classId && c.TeacherId == teacherId);

        if (teacherClass is null)
            return ApiResponse<bool>.Fail("Sinif tapılmadı.");

        // Delete() bool qaytarır — nəticəni yoxlamasaq, silinməyən sinif üçün də
        // interfeys "silindi" deyərdi (səssiz uğursuzluq).
        if (!_db.TeacherClasses.Delete(teacherClass.Id))
            return ApiResponse<bool>.Fail("Sinif silinmədi.");

        return ApiResponse<bool>.Ok(true, "Sinif silindi.");
    }

    /// <summary>
    /// Cari istifadəçinin "tələbə" (User) və "müəllim" (Teacher) rolu arasında keçidini idarə edir.
    /// </summary>
    public Task<ApiResponse<bool>> ChangeRoleAsync(string userId, ChangeRoleRequest request)
    {
        if (request.NewRole != AppRoles.User && request.NewRole != AppRoles.Teacher)
            return Task.FromResult(ApiResponse<bool>.Fail("Yalnız istifadəçi və ya müəllim rolu seçilə bilər."));

        lock (_db.UsersSyncRoot)
        {
            _db.Database.BeginTrans();
            try
            {
                var user = _db.Users.FindById(userId);
                if (user is null || !user.EmailConfirmed || user.LockoutEnd > DateTimeOffset.UtcNow ||
                    user.Roles.Contains(AppRoles.Admin))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail("Bu hesab üçün rol keçidi mümkün deyil."));
                }

                // Sahib hesabı bu yoldan da dəyişdirilə bilməz. Yuxarıdakı Admin yoxlaması
                // onu artıq tutur, lakin bootstrap hələ işləməyibsə sahib hesab müvəqqəti
                // Admin rolsuz ola bilər — bu yoxlama həmin pəncərəni bağlayır.
                if (_protected.IsOwner(user))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage));
                }
                if (user.Roles.Contains(AppRoles.Teacher) && request.NewRole == AppRoles.User &&
                    _db.TeacherClasses.Exists(c => c.TeacherId == userId))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail("Tələbə roluna keçmək üçün əvvəlcə bütün sinifləri silməlisiniz."));
                }
                if (!user.Roles.Contains(request.NewRole))
                {
                    user.Roles.RemoveAll(role => role == AppRoles.User || role == AppRoles.Teacher);
                    user.Roles.Add(request.NewRole);
                    user.SecurityStamp = Guid.NewGuid().ToString();
                    user.ConcurrencyStamp = Guid.NewGuid().ToString();
                    user.RefreshToken = null;
                    user.RefreshTokenExpiryTime = null;
                    user.GoogleLoginCodeHash = null;
                    user.GoogleLoginCodeExpiryTime = null;
                    if (!_db.Users.Update(user)) throw new InvalidOperationException("Hesab yenilənmədi.");
                }
                _db.Database.Commit();
                return Task.FromResult(ApiResponse<bool>.Ok(true, "Rol dəyişdirildi. Yenidən daxil olun."));
            }
            catch { _db.Database.Rollback(); throw; }
        }
    }

    private async Task<(bool Success, string Error)> EnsureTeacherAsync(string teacherId)
    {
        var teacher = await _userManager.FindByIdAsync(teacherId);
        if (teacher is null)
            return (false, "Müəllim hesabı tapılmadı.");

        if (!await _userManager.IsInRoleAsync(teacher, AppRoles.Teacher))
            return (false, "Bu bölmə yalnız müəllimlər üçündür.");

        return (true, string.Empty);
    }

    private Task<TeacherClassResponse> MapToTeacherClassResponseAsync(TeacherClass teacherClass)
    {
        var studentResponses = new List<TeacherClassStudentResponse>();

        // N+1 qarşısı: bütün tələbə ID-lərini tək sorğuda çəkirik.
        // Hər tələbə üçün ayrıca DB sorğusu etmək əvəzinə, hamısını bir dəfədə yükləyib lüğətə çeviririk.
        var studentIds = teacherClass.Students.Select(s => s.StudentId).ToHashSet();
        var students = _db.Users
            .Find(u => studentIds.Contains(u.Id))
            .ToDictionary(u => u.Id);

        foreach (var classStudent in teacherClass.Students.OrderByDescending(s => s.AddedAt))
        {
            if (!students.TryGetValue(classStudent.StudentId, out var student))
                continue;

            if (ProtectedAccountPolicy.IsHiddenAccount(student))
                continue;

            var overview = MapToStudentOverview(student);
            studentResponses.Add(new TeacherClassStudentResponse
            {
                Id        = student.Id,
                Nickname  = student.Nickname,
                FirstName = student.FirstName,
                LastName  = student.LastName,
                AddedAt   = classStudent.AddedAt,
                Summary   = overview.Summary
            });
        }

        return Task.FromResult(new TeacherClassResponse
        {
            Id           = teacherClass.Id,
            Name         = teacherClass.Name,
            CreatedAt    = teacherClass.CreatedAt,
            StudentCount = studentResponses.Count,
            Students     = studentResponses
        });
    }

    private static ProfileResponse MapToProfile(AppUser user, IList<string> roles)
        => new()
        {
            Id              = user.Id,
            Nickname        = user.Nickname,
            FirstName       = user.FirstName,
            LastName        = user.LastName,
            Email           = user.Email ?? string.Empty,
            Gender          = (int)user.Gender,
            JoinDate        = user.CreatedAt,
            Roles           = roles.ToList(),
            ProfileImageUrl = user.ProfileImageUrl
        };

    private StudentOverviewResponse MapToStudentOverview(AppUser student)
    {
        var results = QuizSecurity.ScoredResults(_db.QuizResults
            .Find(r => r.UserId == student.Id))
            .ToList();

        var overview = new StudentOverviewResponse
        {
            Id        = student.Id,
            Nickname  = student.Nickname,
            FirstName = student.FirstName,
            LastName  = student.LastName,
            JoinDate  = student.CreatedAt
        };

        if (results.Count == 0)
            return overview;

        // N+1 qarşısı: kateqoriya adlarını tək sorğuda alırıq.
        // Hər nəticə üçün ayrıca DB sorğusu etmək əvəzinə hamısını yükləyib lüğətə salırıq, sonra GroupBy ilə işləyirik.
        var categoryTitles = _db.QuizCategories
            .FindAll()
            .ToDictionary(c => c.Id, c => c.Title);

        var progressAreas = results
            .GroupBy(r => r.CategoryId)
            .Select(g =>
            {
                int total   = g.Count();
                int correct = g.Count(r => r.IsCorrect);
                return new StudentProgressAreaDto
                {
                    Area         = categoryTitles.TryGetValue(g.Key, out var title) ? title : $"Kateqoriya {g.Key}",
                    Solved       = correct,
                    Total        = total,
                    Percentage   = total > 0 ? (int)Math.Round(correct * 100m / total) : 0,
                    LastActivity = g.Max(r => r.AnsweredAt)
                };
            })
            .ToList();

        var examSessions = results
            .GroupBy(r => r.CategoryId)
            .Select(g =>
            {
                int total   = g.Count();
                int correct = g.Count(r => r.IsCorrect);
                return new
                {
                    CategoryId = g.Key,
                    LastDate   = g.Max(r => r.AnsweredAt),
                    Total      = total,
                    Correct    = correct,
                    Percentage = total > 0 ? (int)Math.Round(correct * 100m / total) : 0
                };
            })
            .OrderByDescending(s => s.LastDate)
            .Take(3)
            .Select(s => new StudentExamSessionDto
            {
                Id         = $"CAT-{s.CategoryId}",
                Title      = categoryTitles.TryGetValue(s.CategoryId, out var title) ? title : $"Kateqoriya {s.CategoryId}",
                Date       = s.LastDate,
                Score      = s.Correct,
                MaxScore   = s.Total,
                Percentage = s.Percentage,
                Status     = "Tamamlandı"
            })
            .ToList();

        int totalCorrect    = results.Count(r => r.IsCorrect);
        int totalAttempted  = results.Count;

        overview.ExamSessions  = examSessions;
        overview.ProgressAreas = progressAreas;
        overview.Summary = new StudentPerformanceSummary
        {
            ExamsTaken      = progressAreas.Count,
            AverageScore    = progressAreas.Count > 0 ? (int)Math.Round(progressAreas.Average(x => x.Percentage)) : 0,
            BestScore       = progressAreas.Count > 0 ? progressAreas.Max(x => x.Percentage) : 0,
            TotalPoints     = totalCorrect,
            OverallProgress = totalAttempted > 0 ? (int)Math.Round(totalCorrect * 100m / totalAttempted) : 0
        };

        return overview;
    }
}
