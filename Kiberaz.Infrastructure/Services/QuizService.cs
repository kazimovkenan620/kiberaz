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

        // LiteDB SQL-in ORDER BY RANDOM() funksiyasını dəstəkləmir, buna görə sualları əvvəlcə yaddaşa çəkirik.
        // Sonra hər sıralama əməliyyatında unikal Guid generasiya edərək təsadüfi ardıcıllıq yaradırıq — bu klassik in-memory shuffle üsuludur.
        var questions = query
            .OrderBy(_ => Guid.NewGuid())
            .Take(count)
            .ToList();

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
}
