namespace Kiberaz.Domain.Entities;

// Questions are immutable snapshots: later edits to the quiz bank do not change an exam.
public class ExamSession
{
    public int QuestionSecurityVersion { get; set; }
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string TeacherId { get; set; } = "";
    public string TeacherName { get; set; } = "";
    public int DurationMinutes { get; set; }
    public long CreatedAt { get; set; }
    public long? ClosedAt { get; set; }
    public List<ExamQuestion> Questions { get; set; } = [];
}

public class ExamQuestion
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Category { get; set; } = "";
    public string Text { get; set; } = "";
    public string CorrectKey { get; set; } = "";
    public List<ExamOption> Options { get; set; } = [];
}

public class ExamOption
{
    public string Key { get; set; } = "";
    public string Text { get; set; } = "";
}

public class ExamAttempt
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ParticipationKey { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string StudentName { get; set; } = "";
    public long StartedAt { get; set; }
    public long ExpiresAt { get; set; }
    public long? SubmittedAt { get; set; }
    public int? CorrectCount { get; set; }
    public int Revision { get; set; }
    public Dictionary<string, string> Answers { get; set; } = [];
}
