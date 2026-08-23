namespace Kiberaz.Application.DTOs.Quiz;

// Public response — CorrectKey is NOT included (returned only after submit)
public class QuizQuestionPublicResponse
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public List<QuizOptionPublicResponse> Options { get; set; } = new();
}

public class QuizOptionPublicResponse
{
    public string Key { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
