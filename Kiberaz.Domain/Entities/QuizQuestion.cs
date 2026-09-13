using Kiberaz.Domain.Common;
using Kiberaz.Domain.Enums;

namespace Kiberaz.Domain.Entities;

// Quiz sualı — cavab seçimləri ayrı cədvəl olmadan bu sənədin içinə embed edilib.
// Suallar həmişə seçimləri ilə birlikdə oxunduğu üçün "birlikdə saxla" prinsipi seçilib — JOIN sorğusu lazım olmur.
public class QuizQuestion : BaseEntity
{
    // Existing questions were public; never silently promote them to a private bank.
    public bool IsExamOnly { get; set; }
    // Sualın aid olduğu kateqoriyanın ID-si — SQL-dəki FK kimi işləyir, amma constraint yoxdur.
    public int QuizCategoryId { get; set; }

    public DifficultyLevel Difficulty { get; set; }

    public string QuestionText { get; set; } = string.Empty;

    // Düzgün cavabın açarı burada saxlanır amma public API cavabında göndərilmir.
    // İstifadəçi /submit endpoint-inə cavabını göndərdikcə, server bu sahəni yoxlayır.
    public string CorrectOptionKey { get; set; } = string.Empty;

    // Hər sualın dəqiq 4 seçimi olur — A, B, C, D.
    // Bunlar ayrı collection-da yox, bu sənəddə embed edilib: bir oxuma ilə hər şey gəlir.
    public List<QuizOption> Options { get; set; } = new();
}

// Sualın bir seçim variantı — QuizQuestion.Options siyahısında yaşayır.
// BaseEntity-dən miras almır, çünki bu sinif müstəqil entity deyil, sualın hissəsidir.
public class QuizOption
{
    // Seçim hərfi: "A", "B", "C", "D" — cavab göndərərkən istifadəçi bu açarı ötürür.
    public string Key { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;

    // İstifadəçi cavab verdikdən sonra göstərilən izahat — doğru cavab üçün niyə doğru,
    // yanlış cavab üçün niyə yanlış olduğu izah edilir.
    public string Explanation { get; set; } = string.Empty;
}
