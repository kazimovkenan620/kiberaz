namespace Kiberaz.Application.DTOs.Quiz;

/// <summary>
/// Quiz kateqoriyasının cavab modeli.
/// Frontend-ə göndərilən kateqoriya məlumatları.
/// </summary>
public class QuizCategoryResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public List<string> Topics { get; set; } = new();
    public int QuestionCount { get; set; }
    public string Difficulty { get; set; } = "Başlanğıc - Orta - Peşəkar";
    public int SortOrder { get; set; }
}
