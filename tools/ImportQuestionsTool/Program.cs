// Sual import aləti — JSON faylındakı sualları birbaşa LiteDB-yə yazır.
//
// NİYƏ AYRICA ALƏT: QuizSeeder yalnız TAM BOŞ bazada işləyir (kateqoriya varsa dərhal çıxır).
// Yəni seed faylına yeni sual əlavə edib API-ni restart etmək heç nə etmir.
// Bu alət mövcud dataya toxunmadan yalnız YENİ sualları əlavə edir —
// baza silinmir, istifadəçilər, admin rolu və quiz nəticələri qalır.
//
// İşlətmək (tools/ImportQuestionsTool qovluğundan):
//   dotnet run -- --file ../../seed-data/web-security.json --dry-run   → yalnız yoxlayır, YAZMIR
//   dotnet run -- --file ../../seed-data/web-security.json             → bazaya yazır
//
// Connection=Shared olduğu üçün API işlək qala bilər; yeni suallar dərhal görünür.

using System.Text.Json;
using JsonSerializer = System.Text.Json.JsonSerializer;
using System.Text;
using LiteDB;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;

var argList = args.ToList();
string? Opt(string name)
{
    int i = argList.IndexOf(name);
    return i >= 0 && i + 1 < argList.Count ? argList[i + 1] : null;
}

bool dryRun = argList.Contains("--dry-run");
string? file = Opt("--file");
string dbPath = Opt("--db") ?? Path.Combine("..", "..", "Kiberaz.Infrastructure", "Data", "Kiberaz.db");

if (string.IsNullOrWhiteSpace(file))
{
    Console.WriteLine("İstifadə: dotnet run -- --file <json-yolu> [--dry-run] [--db <db-yolu>]");
    return 1;
}

string fullFile = Path.GetFullPath(file);
string fullDb = Path.GetFullPath(dbPath);

if (!File.Exists(fullFile)) { Console.WriteLine($"XƏTA: JSON tapılmadı: {fullFile}"); return 1; }
if (!File.Exists(fullDb))   { Console.WriteLine($"XƏTA: DB tapılmadı: {fullDb}"); return 1; }

Console.WriteLine($"JSON : {fullFile}");
Console.WriteLine($"DB   : {fullDb}");
Console.WriteLine(dryRun ? "REJİM: DRY-RUN (heç nə yazılmayacaq)" : "REJİM: YAZMA");
Console.WriteLine();

// Azərbaycanca çətinlik adları — QuizSeeder və QuizService ilə eyni açarlar.
var difficultyMap = new Dictionary<string, DifficultyLevel>
{
    ["Başlanğıc"] = DifficultyLevel.Beginner,
    ["Orta"]      = DifficultyLevel.Intermediate,
    ["Peşəkar"]   = DifficultyLevel.Expert,
};

var jsonOptions = new JsonSerializerOptions
{
    PropertyNameCaseInsensitive = true,
    ReadCommentHandling = JsonCommentHandling.Skip,
    AllowTrailingCommas = true,
};

List<SeedQuestion>? incoming;
try
{
    incoming = JsonSerializer.Deserialize<List<SeedQuestion>>(await File.ReadAllTextAsync(fullFile), jsonOptions);
}
catch (JsonException ex)
{
    Console.WriteLine($"XƏTA: JSON oxunmadı — {ex.Message}");
    return 1;
}

if (incoming is null || incoming.Count == 0) { Console.WriteLine("Fayl boşdur."); return 0; }
Console.WriteLine($"Fayldakı sual sayı: {incoming.Count}");

var connectionString = new ConnectionString { Filename = fullDb, Connection = ConnectionType.Shared };
using var db = new LiteDatabase(connectionString);

var categories = db.GetCollection<QuizCategory>("QuizCategories");
var questions  = db.GetCollection<QuizQuestion>("QuizQuestions");
db.BeginTrans();
// Rollback on dry-run/validation errors; serialize with the API before inspecting either bank.
if (!dryRun)
    db.GetCollection<BsonDocument>("QuestionBankGate")
        .Upsert(new BsonDocument { ["_id"] = "gate", ["version"] = Guid.NewGuid().ToString() });

var validCategories = categories.Find(c => !c.IsDeleted).ToDictionary(c => c.Id, c => c.Title);

// Dublikat yoxlaması sual mətninə görə aparılır — eyni faylı iki dəfə import etmək
// bazada təkrar sual yaratmır.
var existingQuestions = questions.FindAll().ToList();
var existingTexts = existingQuestions
    .Select(q => Normalize(q.QuestionText))
    .ToHashSet(StringComparer.Ordinal);

var accepted = new List<QuizQuestion>();
var errors = new List<string>();
int duplicates = 0;

for (int i = 0; i < incoming.Count; i++)
{
    var q = incoming[i];
    string where = $"#{i + 1}";

    if (!validCategories.ContainsKey(q.CategoryId))
    { errors.Add($"{where}: categoryId={q.CategoryId} bazada yoxdur."); continue; }

    if (!difficultyMap.TryGetValue(q.Difficulty ?? "", out var level))
    { errors.Add($"{where}: çətinlik '{q.Difficulty}' yanlışdır (Başlanğıc / Orta / Peşəkar)."); continue; }

    if (string.IsNullOrWhiteSpace(q.Question))
    { errors.Add($"{where}: sual mətni boşdur."); continue; }

    if (q.Options is null || q.Options.Count != 4)
    { errors.Add($"{where}: dəqiq 4 variant olmalıdır (indi {q.Options?.Count ?? 0})."); continue; }

    var keys = q.Options.Select(o => o.Key?.Trim().ToUpperInvariant() ?? "").ToList();
    if (keys.Distinct().Count() != 4 || !keys.OrderBy(k => k).SequenceEqual(new[] { "A", "B", "C", "D" }))
    { errors.Add($"{where}: variant açarları A, B, C, D olmalıdır."); continue; }

    var correct = q.CorrectKey?.Trim().ToUpperInvariant() ?? "";
    if (!keys.Contains(correct))
    { errors.Add($"{where}: correctKey '{q.CorrectKey}' variantlar arasında yoxdur."); continue; }

    if (q.Options.Any(o => string.IsNullOrWhiteSpace(o.Text)))
    { errors.Add($"{where}: variant mətni boş ola bilməz."); continue; }

    // İzahat məcburidir: layihənin sual qaydası hər variant üçün öyrədici izah tələb edir.
    if (q.Options.Any(o => string.IsNullOrWhiteSpace(o.Explanation)))
    { errors.Add($"{where}: hər 4 variantın izahı olmalıdır."); continue; }

    if (existingQuestions.Concat(accepted).Any(existing => existing.IsExamOnly != q.IsExamOnly &&
        Normalize(existing.QuestionText) == Normalize(q.Question)))
    { errors.Add($"{where}: açıq və məxfi banklar arasında eyni sual qadağandır."); continue; }

    if (!existingTexts.Add(Normalize(q.Question)))
    { duplicates++; continue; }

    accepted.Add(new QuizQuestion
    {
        IsExamOnly       = q.IsExamOnly,
        QuizCategoryId   = q.CategoryId,
        Difficulty       = level,
        QuestionText     = q.Question.Trim(),
        CorrectOptionKey = correct,
        CreatedAt        = DateTime.UtcNow,
        Options = q.Options.Select(o => new QuizOption
        {
            Key         = o.Key!.Trim().ToUpperInvariant(),
            Text        = o.Text!.Trim(),
            Explanation = o.Explanation!.Trim(),
        }).ToList(),
    });
}

Console.WriteLine();
Console.WriteLine($"Qəbul edildi : {accepted.Count}");
Console.WriteLine($"Dublikat     : {duplicates} (bazada eyni sual mətni var)");
Console.WriteLine($"Xətalı       : {errors.Count}");

if (errors.Count > 0)
{
    Console.WriteLine();
    foreach (var e in errors.Take(25)) Console.WriteLine($"  ✗ {e}");
    if (errors.Count > 25) Console.WriteLine($"  ... və daha {errors.Count - 25} xəta");
    Console.WriteLine();
    Console.WriteLine("Xəta varsa HEÇ NƏ yazılmır — əvvəlcə faylı düzəlt.");
    return 1;
}

if (accepted.Count == 0) { Console.WriteLine("Əlavə ediləcək yeni sual yoxdur."); return 0; }

Console.WriteLine();
Console.WriteLine("Kateqoriya üzrə bölgü:");
foreach (var g in accepted.GroupBy(a => a.QuizCategoryId).OrderBy(g => g.Key))
{
    var byLevel = string.Join("  ", new[] { DifficultyLevel.Beginner, DifficultyLevel.Intermediate, DifficultyLevel.Expert }
        .Select(l => $"{l}={g.Count(x => x.Difficulty == l)}"));
    Console.WriteLine($"  id={g.Key,-3} {validCategories[g.Key],-35} {g.Count(),3} sual   ({byLevel})");
}

if (dryRun) { Console.WriteLine(); Console.WriteLine("DRY-RUN: heç nə yazılmadı."); return 0; }

questions.InsertBulk(accepted);
db.Commit();

Console.WriteLine();
Console.WriteLine($"✅ {accepted.Count} sual bazaya əlavə edildi.");
Console.WriteLine($"Bazadakı ümumi sual sayı: {questions.Count()}");
return 0;

// Dublikat müqayisəsi üçün: boşluqlar sıxılır, hərf registri düşürülür.
static string Normalize(string s) => string.Join(' ', s.Normalize(NormalizationForm.FormKC)
    .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();

sealed class SeedQuestion
{
    public bool IsExamOnly { get; set; }
    public int CategoryId { get; set; }
    public string? Difficulty { get; set; }
    public string? Question { get; set; }
    public string? CorrectKey { get; set; }
    public List<SeedOption>? Options { get; set; }
}

sealed class SeedOption
{
    public string? Key { get; set; }
    public string? Text { get; set; }
    public string? Explanation { get; set; }
}
