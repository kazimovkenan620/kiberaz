namespace Kiberaz.Application.DTOs.User;

public class StudentOverviewResponse
{
    public string Id { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime JoinDate { get; set; }
    public StudentPerformanceSummary Summary { get; set; } = new();
    public List<StudentExamSessionDto> ExamSessions { get; set; } = new();
    public List<StudentProgressAreaDto> ProgressAreas { get; set; } = new();
}

public class StudentPerformanceSummary
{
    public int ExamsTaken { get; set; }
    public int AverageScore { get; set; }
    public int BestScore { get; set; }
    public int TotalPoints { get; set; }
    public int OverallProgress { get; set; }
}

public class StudentExamSessionDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int Score { get; set; }
    public int MaxScore { get; set; }
    public int Percentage { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class StudentProgressAreaDto
{
    public string Area { get; set; } = string.Empty;
    public int Solved { get; set; }
    public int Total { get; set; }
    public int Percentage { get; set; }

    /// <summary>
    /// Bu sahədə ən son cavab verilən an. Kabinetdəki "Son fəallıq" göstəricisi
    /// üçün lazımdır — əvvəl orada sabit mətn ("2 gün əvvəl") yazılırdı.
    /// </summary>
    public DateTime? LastActivity { get; set; }
}
