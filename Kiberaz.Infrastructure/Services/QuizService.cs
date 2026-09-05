using Kiberaz.Application.DTOs.Quiz;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

public class QuizService : IQuizService
{
    // Dependency Injection: LiteDbContext burada birbaşa yaradılmır — ASP.NET Core onu özü yaradıb konstruktora ötürür.
    // Bu yanaşma sayəsində həm test yazmaq asanlaşır, həm də bağlantı idarəçiliyi mərkəzləşdirilir.
    private readonly LiteDbContext _db;

    // Enum dəyərlərini Azərbaycanca mətnə çevirmək üçün lüğət — UI-da göstəriş üçün istifadə olunur.
    // static readonly olduğu üçün bütün obyektlər tərəfindən paylaşılır, yaddaşda bir dəfə yaradılır.
    private static readonly Dictionary<DifficultyLevel, string> DifficultyToAz = new()
    {
        [DifficultyLevel.Beginner]     = "Başlanğıc",
        [DifficultyLevel.Intermediate] = "Orta",
        [DifficultyLevel.Expert]       = "Peşəkar"
    };

    // Azərbaycanca mətni Enum-a çevirmək üçün əks istiqamətli lüğət — istifadəçinin göndərdiyi filteri parse etmək üçün lazımdır.
    private static readonly Dictionary<string, DifficultyLevel> AzToDifficulty = new()
    {
        ["Başlanğıc"] = DifficultyLevel.Beginner,
        ["Orta"]      = DifficultyLevel.Intermediate,
        ["Peşəkar"]   = DifficultyLevel.Expert
    };

    public QuizService(LiteDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public Task<List<QuizCategoryResponse>> GetCategoriesAsync()
    {
        var categories = _db.QuizCategories
            .Find(c => !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .ToList();

        // N+1 problemi: hər kateqoriya üçün ayrı-ayrı sorğu göndərmək əvəzinə bütün sual saylarını bir dəfəyə yükləyib lüğətə yığırıq.
        // Sonra hər kateqoriyanı map edərkən verilənlər bazasına deyil, bu lüğətə müraciət edirik.
        var questionCountsByCategoryId = _db.QuizQuestions
            .Find(q => !q.IsDeleted)
            .GroupBy(q => q.QuizCategoryId)
            .ToDictionary(g => g.Key, g => g.Count());

        var result = categories.Select(c =>
        {
            int questionCount = questionCountsByCategoryId.TryGetValue(c.Id, out var cnt) ? cnt : 0;

            return new QuizCategoryResponse
            {
                Id            = c.Id,
                Title         = c.Title,
                Icon          = c.Icon,
                Description   = c.Description,
                Color         = c.Color,
                Topics        = c.Topics,
                QuestionCount = questionCount,
                Difficulty    = "Başlanğıc - Orta - Peşəkar",
                SortOrder     = c.SortOrder
            };
        }).ToList();

        return Task.FromResult(result);
    }

    /// <inheritdoc />
    public Task<List<QuizQuestionPublicResponse>> GetQuestionsAsync(
        int categoryId,
        string? difficulty = null,
        int count = 10)
    {
        var query = _db.QuizQuestions
            .Find(q => q.QuizCategoryId == categoryId && !q.IsDeleted)
            .AsEnumerable();

        if (!string.IsNullOrWhiteSpace(difficulty) &&
            AzToDifficulty.TryGetValue(difficulty, out DifficultyLevel level))
        {
            query = query.Where(q => q.Difficulty == level);
        }

        // LiteDB ORDER BY RANDOM() dəstəkləmir, ona görə qarışdırma yaddaşda edilir.
        // Əvvəl OrderBy(Guid.NewGuid()) işlədilirdi: hər sual üçün Guid yaradıb bütün siyahını sıralayır (O(n log n) + n ədəd Guid).
        // Partial Fisher–Yates yalnız lazım olan `count` element üçün işləyir (O(count)) və statistik olaraq
        // düzgün bərabər paylanma verir — Guid sıralaması bunu zəmanətləndirmir.
        var pool = query.ToList();
        var take = Math.Min(count, pool.Count);

        for (int i = 0; i < take; i++)
        {
            int j = Random.Shared.Next(i, pool.Count);
            (pool[i], pool[j]) = (pool[j], pool[i]);
        }

        var questions = pool.Take(take).ToList();

        // CorrectKey bu cavabda göndərilmir, çünki brauzer network tabında görünən JSON-a daxil olsaydı, istifadəçi quiz-i həll etmədən cavabı öyrənə bilərdi.
        // Doğru cavab yalnız /submit endpoint-ə göndərdikdən sonra server tərəfdən qaytarılır — bu client-side cheating-in qarşısını alır.
        var result = questions.Select(q => new QuizQuestionPublicResponse
        {
            Id         = q.Id,
            CategoryId = q.QuizCategoryId,
            Difficulty = DifficultyToAz.GetValueOrDefault(q.Difficulty, "Başlanğıc"),
            Question   = q.QuestionText,
            Options    = q.Options
                .OrderBy(o => o.Key)
                .Select(o => new QuizOptionPublicResponse
                {
                    Key  = o.Key,
                    Text = o.Text
                })
                .ToList()
        }).ToList();

        return Task.FromResult(result);
    }

    /// <inheritdoc />
    public Task<SubmitAnswerResponse> SubmitAnswerAsync(SubmitAnswerRequest request, string? userId = null)
    {
        var question = _db.QuizQuestions
            .FindOne(q => q.Id == request.QuestionId && !q.IsDeleted);

        if (question is null)
            throw new ArgumentException($"Sual tapılmadı: {request.QuestionId}");

        bool isCorrect = string.Equals(
            request.SelectedKey,
            question.CorrectOptionKey,
            StringComparison.OrdinalIgnoreCase);

        var correctOption = question.Options
            .FirstOrDefault(o => string.Equals(o.Key, question.CorrectOptionKey, StringComparison.OrdinalIgnoreCase));

        // Anonim istifadəçilər də cavab göndərə bilər, lakin nəticə yalnız token ilə daxil olmuş istifadəçilər üçün bazaya yazılır.
        // Bu yanaşma həm açıq test imkanı yaradır, həm də statistika cədvəlini mənasız qeydlərlə şişirtmir.
        if (!string.IsNullOrWhiteSpace(userId))
        {
            _db.QuizResults.Insert(new QuizResult
            {
                UserId      = userId,
                QuestionId  = question.Id,
                CategoryId  = question.QuizCategoryId,
                SelectedKey = request.SelectedKey,
                IsCorrect   = isCorrect,
                AnsweredAt  = DateTime.UtcNow
            });
        }

        return Task.FromResult(new SubmitAnswerResponse
        {
            IsCorrect  = isCorrect,
            CorrectKey = question.CorrectOptionKey,
            Options    = question.Options
                .OrderBy(o => o.Key)
                .Select(o => new SubmitAnswerOptionResult
                {
                    Key         = o.Key,
                    Explanation = o.Explanation
                })
                .ToList()
        });
    }

    /// <inheritdoc />
    public Task<QuizQuestionResponse> CreateQuestionAsync(CreateQuizQuestionRequest request)
    {
        bool categoryExists = _db.QuizCategories
            .Exists(c => c.Id == request.CategoryId && !c.IsDeleted);

        if (!categoryExists)
            throw new ArgumentException($"Kateqoriya tapılmadı: {request.CategoryId}");

        if (!AzToDifficulty.TryGetValue(request.Difficulty, out DifficultyLevel difficulty))
            throw new ArgumentException(
                $"Yanlış çətinlik dəyəri: {request.Difficulty}. İcazə verilən: Başlanğıc, Orta, Peşəkar");

        if (request.Options.Count != 4)
            throw new ArgumentException("Hər sualın dəqiq 4 cavab seçimi olmalıdır.");

        var entity = new QuizQuestion
        {
            QuizCategoryId   = request.CategoryId,
            Difficulty       = difficulty,
            QuestionText     = request.Question,
            CorrectOptionKey = request.CorrectKey,
            CreatedAt        = DateTime.UtcNow,
            Options = request.Options.Select(o => new QuizOption
            {
                Key         = o.Key,
                Text        = o.Text,
                Explanation = o.Explanation
            }).ToList()
        };

        _db.QuizQuestions.Insert(entity);

        return Task.FromResult(new QuizQuestionResponse
        {
            Id         = entity.Id,
            CategoryId = entity.QuizCategoryId,
            Difficulty = DifficultyToAz.GetValueOrDefault(entity.Difficulty, request.Difficulty),
            Question   = entity.QuestionText,
            CorrectKey = entity.CorrectOptionKey,
            Options    = entity.Options
                .OrderBy(o => o.Key)
                .Select(o => new QuizOptionResponse
                {
                    Key         = o.Key,
                    Text        = o.Text,
                    Explanation = o.Explanation
                })
                .ToList()
        });
    }

    /// <inheritdoc />
    public Task<bool> DeleteQuestionAsync(int questionId)
    {
        var question = _db.QuizQuestions
            .FindOne(q => q.Id == questionId && !q.IsDeleted);

        if (question is null)
            return Task.FromResult(false);

        // Fiziki silmə əvəzinə IsDeleted bayrağı true edilir — bu "soft delete" adlanır.
        // Məqsəd: mövcud statistika qeydlərinin daxili əlaqəsini qırmamaq, tarixçəni qorumaq.
        question.IsDeleted = true;
        question.UpdatedAt = DateTime.UtcNow;
        _db.QuizQuestions.Update(question);

        return Task.FromResult(true);
    }

    /// <inheritdoc />
    public Task<QuizCategoryResponse> CreateCategoryAsync(CreateQuizCategoryRequest request)
    {
        var entity = new QuizCategory
        {
            Title       = request.Title,
            Icon        = request.Icon,
            Description = request.Description,
            Color       = request.Color,
            Topics      = request.Topics,
            SortOrder   = request.SortOrder,
            CreatedAt   = DateTime.UtcNow
        };

        _db.QuizCategories.Insert(entity);

        return Task.FromResult(new QuizCategoryResponse
        {
            Id            = entity.Id,
            Title         = entity.Title,
            Icon          = entity.Icon,
            Description   = entity.Description,
            Color         = entity.Color,
            Topics        = entity.Topics,
            QuestionCount = 0,
            Difficulty    = "Başlanğıc - Orta - Peşəkar",
            SortOrder     = entity.SortOrder
        });
    }

    /// <inheritdoc />
    public Task<bool> DeleteCategoryAsync(int categoryId)
    {
        var category = _db.QuizCategories
            .FindOne(c => c.Id == categoryId && !c.IsDeleted);

        if (category is null)
            return Task.FromResult(false);

        category.IsDeleted = true;
        category.UpdatedAt = DateTime.UtcNow;
        _db.QuizCategories.Update(category);

        // Kateqoriya silinəndə ona aid bütün suallar da soft delete edilir — "cascade" əməliyyatı.
        // LiteDB-nin öz cascade mexanizmi yoxdur, buna görə bunu əl ilə foreach ilə həyata keçiririk.
        var questions = _db.QuizQuestions
            .Find(q => q.QuizCategoryId == categoryId && !q.IsDeleted)
            .ToList();

        foreach (var q in questions)
        {
            q.IsDeleted = true;
            q.UpdatedAt = DateTime.UtcNow;
        }

        if (questions.Count > 0)
            _db.QuizQuestions.Update(questions);

        return Task.FromResult(true);
    }

    // ═══════════════════════════════════════════════════════════
    // LİDERLİK LÖVHƏSİ
    // ═══════════════════════════════════════════════════════════

    // Xal çəkiləri: çətin sualı düzgün cavablamaq daha çox dəyər verir.
    // Sabit qayda olduğu üçün nəticə təkrar-təkrar eyni hesablanır — "uydurma bal" yoxdur.
    private static readonly Dictionary<DifficultyLevel, int> ScoreWeights = new()
    {
        [DifficultyLevel.Beginner]     = 5,
        [DifficultyLevel.Intermediate] = 10,
        [DifficultyLevel.Expert]       = 15
    };

    /// <inheritdoc />
    public Task<List<LeaderboardEntryResponse>> GetLeaderboardAsync(string? period, int? categoryId, int limit)
    {
        var now = DateTime.UtcNow;

        // Cari və əvvəlki dövr eyni uzunluqda götürülür ki, sıra dəyişikliyi (change) ədalətli müqayisə olsun.
        (DateTime currentFrom, DateTime previousFrom) = (period ?? "all").ToLowerInvariant() switch
        {
            "weekly"  => (now.AddDays(-7),  now.AddDays(-14)),
            "monthly" => (now.AddDays(-30), now.AddDays(-60)),
            _         => (DateTime.MinValue, DateTime.MinValue)
        };

        var isAllTime = currentFrom == DateTime.MinValue;

        // Bazadan yalnız lazım olan aralıq çəkilir.
        var results = _db.QuizResults
            .Find(r => r.AnsweredAt >= previousFrom)
            .Where(r => !string.IsNullOrWhiteSpace(r.UserId))
            .Where(r => categoryId == null || r.CategoryId == categoryId.Value)
            .ToList();

        if (results.Count == 0)
            return Task.FromResult(new List<LeaderboardEntryResponse>());

        // N+1 qarşısı: sual çətinlikləri, istifadəçilər və kateqoriya adları bir dəfə lüğətə yığılır.
        var difficulties = _db.QuizQuestions
            .FindAll()
            .ToDictionary(q => q.Id, q => q.Difficulty);

        var categoryTitles = _db.QuizCategories
            .FindAll()
            .ToDictionary(c => c.Id, c => c.Title);

        var currentResults = isAllTime
            ? results
            : results.Where(r => r.AnsweredAt >= currentFrom).ToList();

        // Əvvəlki dövr: "ümumi" rejimdə son 7 günü çıxarırıq — yəni "bir həftə əvvəl sıra necə idi".
        var previousResults = isAllTime
            ? results.Where(r => r.AnsweredAt < now.AddDays(-7)).ToList()
            : results.Where(r => r.AnsweredAt >= previousFrom && r.AnsweredAt < currentFrom).ToList();

        var currentStats  = Aggregate(currentResults, difficulties);
        var previousRanks = RankOf(Aggregate(previousResults, difficulties));

        var userIds = currentStats.Keys.ToHashSet();
        var users = _db.Users
            .Find(u => userIds.Contains(u.Id))
            .ToDictionary(u => u.Id);

        var ordered = currentStats
            .Where(kv => users.ContainsKey(kv.Key))
            // Bərabər xalda daha yüksək dəqiqliyi olan öndədir; tam bərabərlikdə ləqəbə görə sabit sıra.
            .OrderByDescending(kv => kv.Value.Score)
            .ThenByDescending(kv => kv.Value.Total == 0 ? 0d : (double)kv.Value.Correct / kv.Value.Total)
            .ThenBy(kv => users[kv.Key].Nickname, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        var entries = new List<LeaderboardEntryResponse>(ordered.Count);

        for (int i = 0; i < ordered.Count; i++)
        {
            var (userId, stat) = (ordered[i].Key, ordered[i].Value);
            var user = users[userId];
            int rank = i + 1;

            // Sıra dəyişikliyi: əvvəlki dövrdə heç görünməyibsə "same" sayılır —
            // "yeni gələn 50 pillə qalxdı" kimi yanıldıcı rəqəm göstərmirik.
            string change = "same";
            int changeValue = 0;

            if (previousRanks.TryGetValue(userId, out var prevRank))
            {
                int delta = prevRank - rank;
                if (delta > 0) { change = "up";   changeValue = delta; }
                else if (delta < 0) { change = "down"; changeValue = -delta; }
            }

            var strongestCategoryId = stat.CorrectByCategory.Count == 0
                ? (int?)null
                : stat.CorrectByCategory.OrderByDescending(kv => kv.Value).First().Key;

            int accuracy = stat.Total == 0 ? 0 : (int)Math.Round(stat.Correct * 100m / stat.Total);

            entries.Add(new LeaderboardEntryResponse
            {
                Rank        = rank,
                // MƏXFİLİK: yalnız ləqəb. Ad/soyad ictimai endpoint-ə heç vaxt düşmür.
                Name        = user.Nickname,
                Username    = $"{stat.Total} cavab · {accuracy}% dəqiqlik",
                Score       = stat.Score,
                Badge       = rank switch { 1 => "gold", 2 => "silver", 3 => "bronze", _ => "default" },
                Avatar      = BuildAvatar(user.Nickname),
                Category    = strongestCategoryId is not null && categoryTitles.TryGetValue(strongestCategoryId.Value, out var title)
                                  ? title
                                  : "—",
                Change      = change,
                ChangeValue = changeValue
            });
        }

        return Task.FromResult(entries);
    }

    // Bir dövrün nəticələrini istifadəçi başına yığır.
    private static Dictionary<string, UserStat> Aggregate(
        List<QuizResult> results,
        Dictionary<int, DifficultyLevel> difficulties)
    {
        var stats = new Dictionary<string, UserStat>(StringComparer.Ordinal);

        foreach (var r in results)
        {
            if (!stats.TryGetValue(r.UserId, out var stat))
            {
                stat = new UserStat();
                stats[r.UserId] = stat;
            }

            stat.Total++;
            if (!r.IsCorrect) continue;

            stat.Correct++;

            // Sual silinibsə çətinliyi tapılmır — ən aşağı çəki ilə sayılır ki, xal itməsin.
            var weight = difficulties.TryGetValue(r.QuestionId, out var d)
                ? ScoreWeights.GetValueOrDefault(d, 5)
                : 5;

            stat.Score += weight;
            stat.CorrectByCategory[r.CategoryId] = stat.CorrectByCategory.GetValueOrDefault(r.CategoryId) + 1;
        }

        return stats;
    }

    // Sıralamanı userId -> rank lüğətinə çevirir (change hesablamaq üçün).
    private static Dictionary<string, int> RankOf(Dictionary<string, UserStat> stats)
        => stats
            .OrderByDescending(kv => kv.Value.Score)
            .Select((kv, index) => (kv.Key, Rank: index + 1))
            .ToDictionary(x => x.Key, x => x.Rank, StringComparer.Ordinal);

    // Ləqəbin ilk iki hərfi. Ləqəb minimum 3 simvoldur, ona görə bu həmişə dolu olur.
    private static string BuildAvatar(string nickname)
    {
        var letters = new string(nickname.Where(char.IsLetterOrDigit).Take(2).ToArray());
        return letters.Length == 0 ? "??" : letters.ToUpperInvariant();
    }

    // Bir istifadəçinin bir dövr üzrə yığılmış göstəriciləri.
    private sealed class UserStat
    {
        public int Score   { get; set; }
        public int Correct { get; set; }
        public int Total   { get; set; }
        public Dictionary<int, int> CorrectByCategory { get; } = new();
    }
}
