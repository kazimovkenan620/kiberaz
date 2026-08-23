namespace Kiberaz.Application.DTOs.Quiz;

/// <summary>
/// Quiz sualının cavab modeli.
/// Frontend-ə göndərilən sual və seçim məlumatları.
/// </summary>
public class QuizQuestionResponse
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public string CorrectKey { get; set; } = string.Empty;
    public List<QuizOptionResponse> Options { get; set; } = new();
}

/// <summary>
/// Quiz sual seçiminin cavab modeli.
/// </summary>
public class QuizOptionResponse
{
    public string Key { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}
