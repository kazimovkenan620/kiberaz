namespace Kiberaz.Application.DTOs.Quiz;

public class CreateQuizCategoryRequest
{
    public string Title { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public List<string> Topics { get; set; } = new();
    public int SortOrder { get; set; }
}
