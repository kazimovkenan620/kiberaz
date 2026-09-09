using LiteDB;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Kiberaz.Infrastructure.Data;

// LiteDB verilənlər bazasına giriş nöqtəsi — bütün collection-lar buradan əldə edilir.
// BsonMapper vasitəsilə entity-lər üçün xüsusi serializasiya qaydaları burada müəyyənləşdirilir ki, domain modeli LiteDB-dən asılı olmasın.
public class LiteDbContext : IDisposable
{
    private readonly LiteDatabase _db;

    // Konstruktor zamanı verilənlər bazası bağlantısı qurulur, mapper konfiqurasiya edilir və indekslər yaradılır.
    // Fayl yolu nisbi verilərsə, tətbiqin kök qovluğuna görə tam yola çevrilir — server harada işləsə fərq etmir.
    public LiteDbContext(IConfiguration configuration, IHostEnvironment environment)
    {
        var connectionStringValue = configuration.GetConnectionString("LiteDb")
            ?? throw new InvalidOperationException("LiteDB connection string 'LiteDb' tapılmadı!");

        var connectionString = new ConnectionString(connectionStringValue);

        // Nisbi fayl yolunu tam yola çeviririk — tətbiq fərqli qovluqdan işləsə belə DB tapılır.
        if (!Path.IsPathRooted(connectionString.Filename))
        {
            connectionString.Filename = Path.GetFullPath(
                Path.Combine(environment.ContentRootPath, connectionString.Filename));
        }

        // Bazanın qovluğu yoxdursa yaradılır. LiteDB faylı özü yaradır, LAKİN qovluğu yaratmır —
        // production-da (məs. App_Data/ və ya /var/kiberaz/data/) bu, tətbiqin start-da
        // DirectoryNotFoundException ilə qəzaya uğramasına səbəb olurdu.
        var databaseDirectory = Path.GetDirectoryName(connectionString.Filename);
        if (!string.IsNullOrEmpty(databaseDirectory) && !Directory.Exists(databaseDirectory))
        {
            Directory.CreateDirectory(databaseDirectory);
        }

        var mapper = new BsonMapper();

        // [BsonId] attribute-u domain entity-lərdə yazmırıq — LiteDB asılılığını domain-dən uzaq saxlamaq üçün
        // Hər entity üçün hansı sahənin primary key olduğunu kod vasitəsilə bildiririk.
        mapper.Entity<AppUser>().Id(u => u.Id);
        mapper.Entity<AppRole>().Id(r => r.Id);
        mapper.Entity<TeacherClass>().Id(t => t.Id, autoId: true);
        mapper.Entity<Category>().Id(c => c.Id, autoId: true);
        mapper.Entity<Article>().Id(a => a.Id, autoId: true);
        mapper.Entity<Course>().Id(c => c.Id, autoId: true);
        mapper.Entity<QuizCategory>().Id(q => q.Id, autoId: true);
        mapper.Entity<QuizQuestion>().Id(q => q.Id, autoId: true);
        mapper.Entity<QuizResult>().Id(q => q.Id, autoId: true);
        mapper.Entity<LoginAttempt>().Id(a => a.Id);
        mapper.Entity<ExamSession>().Id(s => s.Id);
        mapper.Entity<ExamAttempt>().Id(a => a.Id);

        // Enum-lar string kimi saxlanır — oxunaqlıdır və migration asanlaşır
        // Belə ki, DB-də "Beginner" yazısı görünür, rəqəm deyil — debug zamanı rahatdır.
        mapper.RegisterType<DifficultyLevel>(
            serialize:   d => new BsonValue(d.ToString()),
            deserialize: b => Enum.Parse<DifficultyLevel>(b.AsString));

        mapper.RegisterType<CourseStatus>(
            serialize:   s => new BsonValue(s.ToString()),
            deserialize: b => Enum.Parse<CourseStatus>(b.AsString));

        // Gender int kimi saxlanır — mövcud data uyğunluğunu qorumaq üçün
        // Köhnə qeydlər string ola bilər, buna görə hər iki format dəstəklənir.
        mapper.RegisterType<Gender>(
            serialize:   g => new BsonValue((int)g),
            deserialize: b => b.IsString
                ? Enum.Parse<Gender>(b.AsString)
                : (Gender)b.AsInt32);

        _db = new LiteDatabase(connectionString, mapper);
        // Expiry checks use UtcNow. LiteDB otherwise returns local dates and can
        // extend a two-minute login code by the server's timezone offset.
        _db.UtcDate = true;

        ConfigureIndexes();
    }

    /// <summary>AppUser collection — bütün istifadəçilər</summary>
    public ILiteCollection<AppUser> Users
        => _db.GetCollection<AppUser>("Users");

    /// <summary>AppRole collection — rollar (Admin, User, Teacher, ...)</summary>
    public ILiteCollection<AppRole> Roles
        => _db.GetCollection<AppRole>("Roles");

    /// <summary>Kateqoriyalar (Şəbəkə Təhlükəsizliyi, Web Təhlükəsizliyi, ...)</summary>
    public ILiteCollection<Category> Categories
        => _db.GetCollection<Category>("Categories");

    /// <summary>Məqalələr (bilgi bazası)</summary>
    public ILiteCollection<Article> Articles
        => _db.GetCollection<Article>("Articles");

    /// <summary>Müəllim sinfləri — tələbələr embed edilib</summary>
    public ILiteCollection<TeacherClass> TeacherClasses
        => _db.GetCollection<TeacherClass>("TeacherClasses");

    /// <summary>Kurslar / təlimlər</summary>
    public ILiteCollection<Course> Courses
        => _db.GetCollection<Course>("Courses");

    /// <summary>Quiz kateqoriyaları</summary>
    public ILiteCollection<QuizCategory> QuizCategories
        => _db.GetCollection<QuizCategory>("QuizCategories");

    /// <summary>
    /// Quiz sualları — cavab seçimləri (Options) bu collection-da EMBED edilib.
    /// Artıq ayrı QuizQuestionOptions collection-u yoxdur!
    /// </summary>
    public ILiteCollection<QuizQuestion> QuizQuestions
        => _db.GetCollection<QuizQuestion>("QuizQuestions");

    /// <summary>Quiz nəticələri — tələbə statistikası üçün</summary>
    public ILiteCollection<QuizResult> QuizResults
        => _db.GetCollection<QuizResult>("QuizResults");

    /// <summary>
    /// Uğursuz giriş/qeydiyyat cəhdlərinin sayğacları — CAPTCHA həddini hesablamaq üçün.
    /// Açarlar hash halında saxlanılır, qeydlər 15 dəqiqədən sonra köhnəlir.
    /// </summary>
    public ILiteCollection<LoginAttempt> LoginAttempts
        => _db.GetCollection<LoginAttempt>("LoginAttempts");

    /// <summary>
    /// Bal iddiaları: açar "&lt;userId&gt;:&lt;questionId&gt;" — hər sual bir istifadəçiyə yalnız bir dəfə bal yazır.
    /// Sənədin özü boşdur, qoruyucu olan `_id` unikallığıdır.
    /// Kolleksiya əvvəl QuizService-in içində birbaşa yaradılırdı və sxem baxışında görünmürdü.
    /// </summary>
    public ILiteCollection<BsonDocument> QuizScoreClaims
        => _db.GetCollection<BsonDocument>("QuizScoreClaims");

    public ILiteDatabase Database => _db;

    // Identity compare-and-write operations must use the same gate across scoped stores.
    // LiteDB transactions are thread-bound; no await is allowed while holding this gate.
    public object UsersSyncRoot { get; } = new();

    public ILiteCollection<ExamSession> ExamSessions => _db.GetCollection<ExamSession>("ExamSessions");
    public ILiteCollection<ExamAttempt> ExamAttempts => _db.GetCollection<ExamAttempt>("ExamAttempts");
    // Shared by all scoped exam services. No await is allowed inside an exam transaction.
    public object ExamSyncRoot { get; } = new();
    public object QuizSyncRoot { get; } = new();

    // Tez-tez istifadə olunan sahələrə indeks qurur — böyük data olduqda sorğular daha sürətli işləyir.
    // Unique indekslər eyni e-poçt və ya istifadəçi adının iki dəfə yazılmasının qarşısını alır.
    private void ConfigureIndexes()
    {
        Users.EnsureIndex(u => u.NormalizedEmail, unique: true);
        Users.EnsureIndex(u => u.NormalizedUserName, unique: true);
        Users.EnsureIndex(u => u.Email);
        Users.EnsureIndex(u => u.GoogleLoginCodeHash);

        Roles.EnsureIndex(r => r.NormalizedName, unique: true);

        QuizQuestions.EnsureIndex(q => q.QuizCategoryId);
        QuizQuestions.EnsureIndex(q => q.IsDeleted);

        Courses.EnsureIndex(c => c.IsDeleted);

        TeacherClasses.EnsureIndex(t => t.TeacherId);

        Articles.EnsureIndex(a => a.CategoryId);

        QuizResults.EnsureIndex(r => r.UserId);
        QuizResults.EnsureIndex(r => r.CategoryId);

        // Köhnəlmiş cəhd qeydlərinin toplu silinməsi bu indeks üzərindən işləyir.
        LoginAttempts.EnsureIndex(a => a.ExpiresAt);
        ExamSessions.EnsureIndex(s => s.Code, unique: true);
        ExamSessions.EnsureIndex(s => s.TeacherId);
        ExamAttempts.EnsureIndex(a => a.ParticipationKey, unique: true);
        ExamAttempts.EnsureIndex(a => a.SessionId);
        ExamAttempts.EnsureIndex(a => a.StudentId);
    }

    // LiteDB faylını bağlayır — using bloku bitdikdə avtomatik çağrılır.
    // Bağlanmadan çıxılsa fayl zədələnə bilər, buna görə IDisposable tətbiq edilib.
    public void Dispose()
    {
        _db.Dispose();
    }
}
