namespace Kiberaz.Application.DTOs.User;

public class CreateTeacherClassRequest
{
    public string Name { get; set; } = string.Empty;
}

public class AddStudentToClassRequest
{
    public string StudentId { get; set; } = string.Empty;
}

public class TeacherClassResponse
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int StudentCount { get; set; }
    public List<TeacherClassStudentResponse> Students { get; set; } = new();
}

public class TeacherClassStudentResponse
{
    public string Id { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime AddedAt { get; set; }
    public StudentPerformanceSummary Summary { get; set; } = new();
}
