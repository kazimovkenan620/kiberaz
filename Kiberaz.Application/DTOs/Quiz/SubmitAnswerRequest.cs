namespace Kiberaz.Application.DTOs.Quiz;

public class SubmitAnswerRequest
{
    public int QuestionId { get; set; }
    public string SelectedKey { get; set; } = string.Empty;
}

public class SubmitAnswerResponse
{
    public bool IsCorrect { get; set; }
    public string CorrectKey { get; set; } = string.Empty;
    public List<SubmitAnswerOptionResult> Options { get; set; } = new();
}

public class SubmitAnswerOptionResult
{
    public string Key { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}
