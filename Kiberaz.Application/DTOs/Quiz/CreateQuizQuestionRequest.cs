namespace Kiberaz.Application.DTOs.Quiz;

/// <summary>
/// Yeni quiz sualı yaratma sorğu modeli.
/// Admin panel üçün — gələcəkdə CRUD əməliyyatları üçün istifadə ediləcək.
/// </summary>
public class CreateQuizQuestionRequest
{
    public int CategoryId { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string CorrectKey { get; set; } = string.Empty;
    public List<CreateQuizOptionRequest> Options { get; set; } = new();
}

/// <summary>
/// Yeni quiz sual seçimi yaratma sorğu modeli.
/// </summary>
public class CreateQuizOptionRequest
{
    public string Key { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}
