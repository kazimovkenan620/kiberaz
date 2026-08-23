using System.Text.Json;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Data;

// Tətbiq ilk dəfə işə düşdükdə quiz kateqoriyalarını və suallarını JSON fayllardan oxuyub verilənlər bazasına yazır.
// Seed yalnız bir dəfə işləyir — əgər artıq kateqoriya varsa, əməliyyat atlanır.
public static class QuizSeeder
{
    // JSON faylını oxumaq üçün müvəqqəti istifadə olunan daxili model — domain entity-sindən ayrıdır.
    private sealed class SeedCategory
    {
        public int            Id          { get; set; }
        public string         Title       { get; set; } = "";
        public string         Icon        { get; set; } = "";
        public string         Description { get; set; } = "";
        public string         Color       { get; set; } = "";
        public List<string>   Topics      { get; set; } = new();
        public int            SortOrder   { get; set; }
    }

    // JSON-dan sual oxumaq üçün müvəqqəti model — seçim variantları da daxildir.
    private sealed class SeedQuestion
    {
        public int              CategoryId  { get; set; }
        public string           Difficulty  { get; set; } = "";
        public string           Question    { get; set; } = "";
        public string           CorrectKey  { get; set; } = "";
        public List<SeedOption> Options     { get; set; } = new();
    }

    // Seçim variantını JSON-dan oxumaq üçün daxili model.
    private sealed class SeedOption
    {
        public string Key         { get; set; } = "";
        public string Text        { get; set; } = "";
        public string Explanation { get; set; } = "";
    }

    // Azərbaycanca çətinlik adlarını enum dəyərlərinə uyğunlaşdırır — JSON faylda Azerbaycanca yazılır.
    private static readonly Dictionary<string, DifficultyLevel> DifficultyMap = new()
    {
        ["Başlanğıc"] = DifficultyLevel.Beginner,
        ["Orta"]      = DifficultyLevel.Intermediate,
        ["Peşəkar"]   = DifficultyLevel.Expert
    };

    // JSON oxuyarkən böyük/kiçik hərf fərqi nəzərə alınmır, şərhlər və son vergül qəbul edilir.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling         = JsonCommentHandling.Skip,
        AllowTrailingCommas         = true
    };

    // Verilənlər bazası boşdursa JSON fayllardan kateqoriya və sualları oxuyub doldurur.
    // İdempotentdir — artıq data varsa ikinci dəfə işlətmək heç nəyi dəyişmir.
    public static async Task SeedQuizDataAsync(LiteDbContext db, string? seedDataPath = null)
    {
        // Əgər artıq kateqoriya varsa, seed prosesi atlanır — iki dəfə işləməsin deyə.
        if (db.QuizCategories.Count() > 0)
            return;

        string basePath = seedDataPath ?? FindSeedDataPath();

        string categoriesFile = Path.Combine(basePath, "quiz-categories.json");
        string questionsFile  = Path.Combine(basePath, "quiz-questions.json");

        if (!File.Exists(categoriesFile))
        {
            Console.WriteLine($"⚠️ QuizSeeder: {categoriesFile} tapılmadı — seed atlanır.");
            return;
        }

        string catJson = await File.ReadAllTextAsync(categoriesFile);
        List<SeedCategory>? seedCategories = JsonSerializer.Deserialize<List<SeedCategory>>(catJson, JsonOptions);

        if (seedCategories is null || seedCategories.Count == 0)
        {
            Console.WriteLine("⚠️ QuizSeeder: quiz-categories.json boşdur.");
            return;
        }

        // JSON-dakı seed modellər domain entity-lərinə çevrilir — birbaşa JSON modelini DB-yə yazmırıq.
        var categoryEntities = seedCategories.Select(sc => new QuizCategory
        {
            Id          = sc.Id,
            Title       = sc.Title,
            Icon        = sc.Icon,
            Description = sc.Description,
            Color       = sc.Color,
            Topics      = sc.Topics,
            SortOrder   = sc.SortOrder,
            CreatedAt   = DateTime.UtcNow
        }).ToList();

        // InsertBulk tək-tək insert-dən daha sürətlidir — böyük sual toplusunda fərq hiss olunur.
        db.QuizCategories.InsertBulk(categoryEntities);
        Console.WriteLine($"✅ QuizSeeder: {categoryEntities.Count} kateqoriya seed edildi.");

        if (!File.Exists(questionsFile))
        {
            Console.WriteLine($"⚠️ QuizSeeder: {questionsFile} tapılmadı — suallar atlanır.");
            return;
        }

        string qJson = await File.ReadAllTextAsync(questionsFile);
        List<SeedQuestion>? seedQuestions = JsonSerializer.Deserialize<List<SeedQuestion>>(qJson, JsonOptions);

        if (seedQuestions is null || seedQuestions.Count == 0)
        {
            Console.WriteLine("ℹ️ QuizSeeder: quiz-questions.json boşdur — suallar sonra əlavə ediləcək.");
            return;
        }

        // Mövcud kateqoriya ID-ləri HashSet-də saxlanılır — O(1) axtarış üçün, List-dən çox sürətlidir.
        HashSet<int> validCategoryIds = categoryEntities.Select(c => c.Id).ToHashSet();

        var questionEntities = new List<QuizQuestion>();
        foreach (SeedQuestion sq in seedQuestions)
        {
            // Kateqoriyası olmayan sual bazaya yazılmır — referans bütövlüyünü qoruyuruq.
            if (!validCategoryIds.Contains(sq.CategoryId))
            {
                Console.WriteLine($"⚠️ QuizSeeder: categoryId={sq.CategoryId} tapılmadı, sual atlanır.");
                continue;
            }

            // Tanınmayan çətinlik səviyyəsi olan sual atlanır — enum dəyəri olmayan string qəbul edilmir.
            if (!DifficultyMap.TryGetValue(sq.Difficulty, out DifficultyLevel difficulty))
            {
                Console.WriteLine($"⚠️ QuizSeeder: Tanınmayan çətinlik: '{sq.Difficulty}', sual atlanır.");
                continue;
            }

            // Cavab seçimləri (Options) sualın içinə embed edilir — ayrı collection yoxdur, sorğu sadədir.
            questionEntities.Add(new QuizQuestion
            {
                QuizCategoryId   = sq.CategoryId,
                Difficulty       = difficulty,
                QuestionText     = sq.Question,
                CorrectOptionKey = sq.CorrectKey,
                CreatedAt        = DateTime.UtcNow,
                Options = sq.Options.Select(o => new QuizOption
                {
                    Key         = o.Key,
                    Text        = o.Text,
                    Explanation = o.Explanation
                }).ToList()
            });
        }

        db.QuizQuestions.InsertBulk(questionEntities);

        int totalQuestions = db.QuizQuestions.Count();
        Console.WriteLine($"✅ QuizSeeder: {totalQuestions} sual seed edildi (options embedded).");
    }

    // Seed data qovluğunu tətbiqin icra kataloqundan başlayaraq yuxarı qovluqlarda axtarır.
    // Bu üsul həm development, həm də Docker mühitlərində işləyir — fayl yolu sərt kodlanmır.
    private static string FindSeedDataPath()
    {
        string? dir = AppDomain.CurrentDomain.BaseDirectory;

        // Ən çox 8 səviyyə yuxarı qalxırıq — bu, mono-repo strukturunda belə seed-data-nı tapır.
        for (int i = 0; i < 8 && dir != null; i++)
        {
            string candidate = Path.Combine(dir, "seed-data");
            if (Directory.Exists(candidate))
                return candidate;
            dir = Directory.GetParent(dir)?.FullName;
        }

        return Path.Combine(Directory.GetCurrentDirectory(), "seed-data");
    }
}
