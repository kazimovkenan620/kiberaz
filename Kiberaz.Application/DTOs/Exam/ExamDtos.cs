namespace Kiberaz.Application.DTOs.Exam;

public record ExamCategorySelection(int CategoryId, int Count);
public record CreateExamRequest(string Title, int DurationMinutes, List<ExamCategorySelection> Categories);
public record JoinExamRequest(string Code);
public record SaveExamAnswerRequest(string QuestionId, string OptionKey, int Revision);
public record ExamCategoryResponse(int Id, string Title, int QuestionCount);
// `TeacherName` sahəsi tarixi addır (frontend müqaviləsi) — sessiyanı yaradan VIP hesabın nickname-idir.
public record ExamSessionResponse(string Id, string Code, string Title, string TeacherName,
    int DurationMinutes, int QuestionCount, DateTimeOffset CreatedAt, bool IsClosed);
public record ExamOptionResponse(string Key, string Text);
public record ExamQuestionResponse(string Id, string Category, string Text, List<ExamOptionResponse> Options);
public record ExamAttemptResponse(string Id, ExamSessionResponse Session, DateTimeOffset ServerNow,
    DateTimeOffset ExpiresAt, DateTimeOffset? SubmittedAt, int? CorrectCount, decimal? Percentage,
    int Revision, Dictionary<string, string> Answers, List<ExamQuestionResponse> Questions);
public record ExamAttemptSummary(string Id, ExamSessionResponse Session, DateTimeOffset StartedAt,
    DateTimeOffset? SubmittedAt, int? CorrectCount, decimal? Percentage);
/// <summary>
/// VIP hesabın günlük sessiya kvotası. Yalnız məlumat məqsədlidir — həqiqi limit serverdə,
/// yaratma anında, kilid altında yoxlanılır; client bu rəqəmə əsaslanaraq heç nəyi "aça" bilməz.
/// </summary>
public record ExamQuotaResponse(int DailyLimit, int UsedToday, int Remaining, DateTimeOffset ResetsAt);
/// <param name="Quota">Yalnız sessiya yarada bilən (VIP) hesablar üçün doldurulur; digərləri üçün null.</param>
public record ExamOverviewResponse(List<ExamSessionResponse> Sessions, List<ExamAttemptSummary> Attempts,
    ExamQuotaResponse? Quota);
public record ExamParticipantResponse(string Id, string Name, DateTimeOffset StartedAt,
    DateTimeOffset? SubmittedAt, int AnsweredCount, int? CorrectCount, decimal? Percentage);
public record ExamDashboardResponse(ExamSessionResponse Session, List<ExamParticipantResponse> Participants);

public sealed class ExamRequestException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
