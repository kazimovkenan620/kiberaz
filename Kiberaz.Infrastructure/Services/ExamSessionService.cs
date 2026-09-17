using System.Security.Cryptography;
using Kiberaz.Application.DTOs.Exam;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

// Sessiya yaratmaq, canlı panel və bağlama yalnız VIP rolu üçündür; qoşulub cavab yazmaq
// bütün adi hesablar üçün açıqdır. Admin/sahib hesab imtahan fəaliyyətində iştirak etmir.
// Entity-dəki `TeacherId`/`TeacherName` sahələri tarixi adlardır — sessiyanın sahibi (host) deməkdir;
// mövcud bazadakı sənədlərin oxunmasını pozmamaq üçün adlar dəyişdirilməyib.
public class ExamSessionService(LiteDbContext db, TimeProvider clock) : IExamSessionService
{
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();

    // LiteDB transactions are thread-bound. All read/validate/write steps stay synchronous
    // under the context's shared gate, so close, autosave and submit cannot race each other.
    private T Atomic<T>(Func<T> action)
    {
        lock (db.ExamSyncRoot)
        {
            db.Database.BeginTrans();
            try { var value = action(); db.Database.Commit(); return value; }
            catch { db.Database.Rollback(); throw; }
        }
    }

    // Açıq bankda görünən sual mətnləri bir dəfə hesablanır və bütün kateqoriyalar üçün
    // təkrar istifadə olunur. Əvvəl `Available` hər kateqoriya üçün ayrıca tam skan + Unicode
    // normalizasiya edirdi, üstəlik bunların hamısı `ExamSyncRoot` kilidi altında baş verirdi —
    // yəni sahib bu siyahını açdıqca tələbələrin cavab yazıları gözləyirdi.
    public List<ExamCategoryResponse> GetCategories() => Atomic(() =>
    {
        var exposed = ExposedQuestionTexts();
        return db.QuizCategories
            .Find(c => !c.IsDeleted).OrderBy(c => c.SortOrder)
            .Select(c => new ExamCategoryResponse(c.Id, c.Title.TrimStart('_'), Available(c.Id, exposed).Count))
            .ToList();
    });

    public ExamSessionResponse Create(string userId, CreateExamRequest request) => Atomic(() =>
    {
        var host = Host(userId, requireActiveTerm: true);
        // Validator eyni qaydaları controller-dən əvvəl yoxlayır; burada təkrar yoxlama
        // "defence in depth"-dir — servis birbaşa çağırıldıqda da (test, gələcək endpoint) invariant pozulmur.
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Trim().Length > ExamPolicy.MaxTitleLength ||
            request.DurationMinutes is < ExamPolicy.MinDurationMinutes or > ExamPolicy.MaxDurationMinutes ||
            request.Categories is null || request.Categories.Count is < 1 or > ExamPolicy.MaxCategoriesPerSession ||
            request.Categories.Any(c => c is null || c.Count is < 1 or > ExamPolicy.MaxQuestionsPerSession) ||
            request.Categories.Sum(c => c.Count) > ExamPolicy.MaxQuestionsPerSession ||
            request.Categories.Select(c => c.CategoryId).Distinct().Count() != request.Categories.Count)
            throw Error(400, $"Ad, {ExamPolicy.MinDurationMinutes}–{ExamPolicy.MaxDurationMinutes} dəqiqə və kateqoriyalar üzrə cəmi 1–{ExamPolicy.MaxQuestionsPerSession} sual seçin.");

        // GÜNLÜK LİMİT: hər VIP hesab bir UTC günündə ən çox 7 sessiya yarada bilər.
        // Sayğac kilid altında, yazıdan dərhal əvvəl oxunur — paralel iki sorğu limiti keçə bilməz.
        // Bağlanmış sessiyalar da sayılır: limit "yaradılan" sessiyaların sayıdır, "açıq" olanların yox.
        var quota = Quota(userId);
        if (quota.Remaining <= 0)
            throw Error(429, $"Günlük limit dolub: bir VIP hesab gündə ən çox {ExamPolicy.DailySessionsPerHost} sessiya yarada bilər. Limit UTC 00:00-da yenilənir.");
        if (db.ExamSessions.Count(s => s.TeacherId == userId && s.ClosedAt == null && s.QuestionSecurityVersion == 1) >= ExamPolicy.MaxOpenSessionsPerHost)
            throw Error(409, $"Əvvəlcə açıq sessiyalardan birini bağlayın (maksimum {ExamPolicy.MaxOpenSessionsPerHost}).");

        var session = new ExamSession
        {
            Title = request.Title.Trim(), TeacherId = userId, TeacherName = host.Nickname,
            DurationMinutes = request.DurationMinutes, CreatedAt = Now, QuestionSecurityVersion = 1
        };
        var exposedTexts = ExposedQuestionTexts();
        foreach (var selection in request.Categories)
        {
            var category = db.QuizCategories.FindById(selection.CategoryId);
            if (category is null || category.IsDeleted) throw Error(400, "Kateqoriya tapılmadı.");
            var questions = Available(selection.CategoryId, exposedTexts);
            if (questions.Count < selection.Count)
                throw Error(400, $"{category.Title.TrimStart('_')}: yalnız {questions.Count} məxfi imtahan sualı var. Administrator ayrıca imtahan sualları əlavə etməlidir.");
            Shuffle(questions);
            session.Questions.AddRange(questions.Take(selection.Count).Select(q => new ExamQuestion
            {
                Category = category.Title.TrimStart('_'), Text = q.QuestionText, CorrectKey = q.CorrectOptionKey,
                Options = q.Options.Select(o => new ExamOption { Key = o.Key, Text = o.Text }).ToList()
            }));
        }
        Shuffle(session.Questions);
        do { session.Code = ExamPolicy.CodePrefix + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)); }
        while (db.ExamSessions.Exists(s => s.Code == session.Code));
        db.ExamSessions.Insert(session);
        return SessionView(session);
    });

    public ExamOverviewResponse GetOverview(string userId) => Atomic(() =>
    {
        var user = User(userId);
        if (ProtectedAccountPolicy.IsHiddenAccount(user))
            return new ExamOverviewResponse([], [], null);
        // Kvota yalnız sessiya yarada bilən hesablara göstərilir — başqa rollar üçün mənasız rəqəmdir.
        var quota = user.Roles.Contains(AppRoles.VIP) ? Quota(userId) : null;
        var sessions = db.ExamSessions.Find(s => s.TeacherId == userId).OrderByDescending(s => s.CreatedAt)
            .Take(100).Select(SessionView).ToList();
        var attempts = new List<ExamAttemptSummary>();
        foreach (var attempt in db.ExamAttempts.Find(a => a.StudentId == userId).OrderByDescending(a => a.StartedAt).Take(100))
        {
            var session = db.ExamSessions.FindById(attempt.SessionId);
            if (session is null) continue;
            Expire(attempt, session);
            attempts.Add(new(attempt.Id, SessionView(session), Date(attempt.StartedAt), NullableDate(attempt.SubmittedAt),
                attempt.CorrectCount, Percentage(attempt, session)));
        }
        return new ExamOverviewResponse(sessions, attempts, quota);
    });

    public ExamAttemptResponse Join(string userId, string code) => Atomic(() =>
    {
        var user = User(userId);
        RejectAdminActivity(user);
        var session = Session(code);
        RequirePrivateBank(session);
        var key = session.Id + ":" + userId;
        var existing = db.ExamAttempts.FindOne(a => a.ParticipationKey == key);
        if (existing is not null) { Expire(existing, session); return AttemptView(existing, session); }
        if (session.ClosedAt is not null) throw Error(409, "Bu sessiya artıq bağlanıb.");
        if (session.TeacherId == userId) throw Error(400, "Öz sessiyanıza iştirakçı kimi qoşula bilməzsiniz.");
        if (db.ExamAttempts.Count(a => a.SessionId == session.Id) >= ExamPolicy.MaxParticipantsPerSession)
            throw Error(409, "Sessiyanın iştirakçı limiti dolub.");
        var attempt = new ExamAttempt
        {
            ParticipationKey = key, SessionId = session.Id, StudentId = userId, StudentName = user.Nickname,
            StartedAt = Now, ExpiresAt = Now + session.DurationMinutes * 60_000L
        };
        db.ExamAttempts.Insert(attempt);
        return AttemptView(attempt, session);
    });

    public ExamAttemptResponse GetAttempt(string userId, string attemptId) => Atomic(() =>
    {
        var (attempt, session) = OwnedAttempt(userId, attemptId);
        Expire(attempt, session);
        return AttemptView(attempt, session);
    });

    public ExamAttemptResponse SaveAnswer(string userId, string attemptId, SaveExamAnswerRequest request) => Atomic(() =>
    {
        var (attempt, session) = OwnedAttempt(userId, attemptId);
        Expire(attempt, session);
        if (attempt.SubmittedAt is not null) return AttemptView(attempt, session);
        if (attempt.Revision != request.Revision) throw Error(409, "İmtahan başqa pəncərədə dəyişib. Yeniləyib cavabı təkrar seçin.");
        var question = session.Questions.SingleOrDefault(q => q.Id == request.QuestionId);
        if (question is null || !question.Options.Any(o => o.Key == request.OptionKey))
            throw Error(400, "Sual və ya cavab variantı düzgün deyil.");
        attempt.Answers[question.Id] = request.OptionKey;
        attempt.Revision++;
        db.ExamAttempts.Update(attempt);
        return AttemptView(attempt, session);
    });

    public ExamAttemptResponse Submit(string userId, string attemptId) => Atomic(() =>
    {
        var (attempt, session) = OwnedAttempt(userId, attemptId);
        Expire(attempt, session);
        Finish(attempt, session, Now);
        return AttemptView(attempt, session);
    });

    public ExamDashboardResponse GetDashboard(string userId, string code) => Atomic(() =>
    {
        var session = OwnedSession(userId, code);
        var participants = new List<ExamParticipantResponse>();
        foreach (var attempt in db.ExamAttempts.Find(a => a.SessionId == session.Id).OrderBy(a => a.StartedAt))
        {
            // Gizli (sahib/Admin) hesab heç bir iştirakçı siyahısında görünmür — serverdə, serializasiyadan əvvəl süzülür.
            // Əvvəl bütün Users kolleksiyası hər 10 saniyəlik panel sorğusunda tam oxunurdu; indi yalnız iştirakçılar yoxlanılır.
            if (ProtectedAccountPolicy.IsHiddenAccount(db.Users.FindById(attempt.StudentId))) continue;
            Expire(attempt, session);
            participants.Add(new(attempt.Id, attempt.StudentName, Date(attempt.StartedAt), NullableDate(attempt.SubmittedAt),
                attempt.Answers.Count, attempt.CorrectCount, Percentage(attempt, session)));
        }
        return new ExamDashboardResponse(SessionView(session), participants);
    });

    public ExamSessionResponse Close(string userId, string code) => Atomic(() =>
    {
        var session = OwnedSession(userId, code);
        if (session.ClosedAt is null)
        {
            session.ClosedAt = Now;
            db.ExamSessions.Update(session);
            foreach (var attempt in db.ExamAttempts.Find(a => a.SessionId == session.Id).ToList())
                Expire(attempt, session);
        }
        return SessionView(session);
    });

    /// <summary>
    /// Cari UTC günü üçün sahibin kvotası. Yalnız ExamSyncRoot altında çağırılır (Atomic içindən),
    /// ona görə Create-dəki "oxu → müqayisə → yaz" ardıcıllığı atomikdir.
    /// Sorğu `TeacherId` indeksi ilə işləyir; günə görə süzgəc həmin hesabın sessiyaları üzərində aparılır.
    /// </summary>
    private ExamQuotaResponse Quota(string userId)
    {
        var now = clock.GetUtcNow();
        var dayStart = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var dayStartMs = dayStart.ToUnixTimeMilliseconds();
        var used = db.ExamSessions.Count(s => s.TeacherId == userId && s.CreatedAt >= dayStartMs);
        return new ExamQuotaResponse(ExamPolicy.DailySessionsPerHost, used,
            Math.Max(0, ExamPolicy.DailySessionsPerHost - used), dayStart.AddDays(1));
    }

    /// <summary>Açıq (ictimai) bankda görünən sual mətnləri — imtahan bankından çıxarılmalı olanlar.</summary>
    private HashSet<string> ExposedQuestionTexts() => db.QuizQuestions
        .Find(q => !q.IsExamOnly).ToList()
        .Select(q => QuizSecurity.NormalizeQuestion(q.QuestionText)).ToHashSet(StringComparer.Ordinal);

    /// <param name="exposedTexts">Bir dəfə hesablanmış açıq mətnlər; verilməzsə burada hesablanır.</param>
    private List<QuizQuestion> Available(int categoryId, HashSet<string>? exposedTexts = null)
    {
        var exposed = exposedTexts ?? ExposedQuestionTexts();
        return db.QuizQuestions
        .Find(q => q.QuizCategoryId == categoryId && !q.IsDeleted && q.IsExamOnly).Where(q =>
            !exposed.Contains(QuizSecurity.NormalizeQuestion(q.QuestionText)) &&
            !string.IsNullOrWhiteSpace(q.QuestionText) && q.Options.Count is >= 2 and <= 6 &&
            q.Options.All(o => !string.IsNullOrWhiteSpace(o.Key) && !string.IsNullOrWhiteSpace(o.Text)) &&
            q.Options.Select(o => o.Key).Distinct().Count() == q.Options.Count &&
            q.Options.Count(o => o.Key == q.CorrectOptionKey) == 1).ToList();
    }

    private static void RequirePrivateBank(ExamSession session)
    {
        if (session.QuestionSecurityVersion != 1)
            throw Error(409, "Bu sessiya açıq sual bankından yaradılıb. Sessiya sahibi məxfi suallarla yeni sessiya yaratmalıdır.");
    }

    private AppUser User(string id) => db.Users.FindById(id) ?? throw Error(401, "Hesab tapılmadı. Yenidən daxil olun.");

    /// <summary>
    /// Sessiya sahibi ola biləcək hesab: yalnız VIP. Rol JWT-dən deyil, bazadakı cari dəyərdən oxunur —
    /// controller-dəki [Authorize(Roles = VIP)] birinci sədd, bu isə ikinci sədddir (rol dəqiqə əvvəl alınmış ola bilər).
    /// </summary>
    private AppUser Host(string id, bool requireActiveTerm = false)
    {
        var user = User(id);
        RejectAdminActivity(user);
        if (!user.Roles.Contains(AppRoles.VIP))
            throw Error(403, "İmtahan sessiyası yaratmaq yalnız VIP hesablar üçün açıqdır.");
        // Yeni sessiya üçün VIP dövrü aktiv olmalıdır; mövcud sessiyaların paneli/bağlanması rol ilə kifayətlənir
        // (dövr bitəndə sahib öz nəticələrinə çatmağa davam edir, amma yeni sessiya aça bilmir — audit L11).
        if (requireActiveTerm && VipEntitlements.ActiveTerm(db, user.Id, clock.GetUtcNow().UtcDateTime) is null)
            throw Error(403, "Aktiv VIP dövrünüz yoxdur. Yeni imtahan sessiyası üçün VIP üzvlüyü yeniləyin.");
        return user;
    }
    private static void RejectAdminActivity(AppUser user)
    {
        if (ProtectedAccountPolicy.IsHiddenAccount(user))
            throw Error(403, "Admin hesabı imtahan fəaliyyətində iştirak etmir.");
    }
    private ExamSession Session(string? code)
    {
        var normalized = code?.Trim().ToUpperInvariant() ?? "";
        if (normalized.Length != ExamPolicy.CodeLength || !normalized.StartsWith(ExamPolicy.CodePrefix, StringComparison.Ordinal) ||
            normalized[ExamPolicy.CodePrefix.Length..].Any(c => !Uri.IsHexDigit(c)))
            throw Error(400, "Kodu KBR-1234567890ABCDEF formatında daxil edin.");
        return db.ExamSessions.FindOne(s => s.Code == normalized) ?? throw Error(404, "Sessiya tapılmadı. Kodu yoxlayın.");
    }
    private ExamSession OwnedSession(string userId, string code)
    {
        Host(userId);
        var session = Session(code);
        // Başqasının sessiyası 403 deyil, 404 qaytarır — kodun mövcudluğu sızdırılmır.
        if (session.TeacherId != userId) throw Error(404, "Sessiya tapılmadı.");
        return session;
    }
    private (ExamAttempt, ExamSession) OwnedAttempt(string userId, string id)
    {
        RejectAdminActivity(User(userId));
        if (id.Length != 32 || id.Any(c => !Uri.IsHexDigit(c)))
            throw Error(404, "İmtahan tapılmadı.");
        var attempt = db.ExamAttempts.FindById(id);
        if (attempt is null || attempt.StudentId != userId) throw Error(404, "İmtahan tapılmadı.");
        var session = db.ExamSessions.FindById(attempt.SessionId) ?? throw Error(404, "Sessiya tapılmadı.");
        RequirePrivateBank(session);
        return (attempt, session);
    }
    private void Expire(ExamAttempt attempt, ExamSession session)
    {
        var end = Math.Min(attempt.ExpiresAt, session.ClosedAt ?? long.MaxValue);
        if (Now >= end) Finish(attempt, session, end);
    }
    private void Finish(ExamAttempt attempt, ExamSession session, long time)
    {
        if (attempt.SubmittedAt is not null) return;
        attempt.CorrectCount = session.QuestionSecurityVersion == 1
            ? session.Questions.Count(q => attempt.Answers.TryGetValue(q.Id, out var key) && key == q.CorrectKey)
            : null; // Do not mint new trusted grades from already exposed legacy questions.
        attempt.SubmittedAt = time;
        attempt.Revision++;
        db.ExamAttempts.Update(attempt);
    }
    private ExamAttemptResponse AttemptView(ExamAttempt a, ExamSession s) => new(a.Id, SessionView(s), Date(Now),
        Date(a.ExpiresAt), NullableDate(a.SubmittedAt), a.CorrectCount, Percentage(a, s), a.Revision, a.Answers,
        s.Questions.Select(q => new ExamQuestionResponse(q.Id, q.Category, q.Text,
            q.Options.Select(o => new ExamOptionResponse(o.Key, o.Text)).ToList())).ToList());
    private static ExamSessionResponse SessionView(ExamSession s) => new(s.Id, s.Code, s.Title, s.TeacherName,
        s.DurationMinutes, s.Questions.Count, Date(s.CreatedAt), s.ClosedAt is not null || s.QuestionSecurityVersion != 1);
    private static DateTimeOffset Date(long value) => DateTimeOffset.FromUnixTimeMilliseconds(value);
    private static DateTimeOffset? NullableDate(long? value) => value is { } v ? Date(v) : null;
    private static decimal? Percentage(ExamAttempt a, ExamSession s) => a.CorrectCount is { } count
        ? Math.Round(count * 100m / s.Questions.Count, 2) : null;
    private static ExamRequestException Error(int status, string message) => new(status, message);
    private static void Shuffle<T>(List<T> values)
    {
        for (var i = values.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (values[i], values[j]) = (values[j], values[i]);
        }
    }
}
