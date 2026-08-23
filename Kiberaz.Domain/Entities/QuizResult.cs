namespace Kiberaz.Domain.Entities;

public class QuizResult
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public int QuestionId { get; set; }
    public int CategoryId { get; set; }
    public string SelectedKey { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public DateTime AnsweredAt { get; set; }
}
