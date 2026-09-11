using Kiberaz.Application.DTOs.Exam;

namespace Kiberaz.Application.Interfaces;

public interface IExamSessionService
{
    List<ExamCategoryResponse> GetCategories();
    ExamSessionResponse Create(string userId, CreateExamRequest request);
    ExamOverviewResponse GetOverview(string userId);
    ExamAttemptResponse Join(string userId, string code);
    ExamAttemptResponse GetAttempt(string userId, string attemptId);
    ExamAttemptResponse SaveAnswer(string userId, string attemptId, SaveExamAnswerRequest request);
    ExamAttemptResponse Submit(string userId, string attemptId);
    ExamDashboardResponse GetDashboard(string userId, string code);
    ExamSessionResponse Close(string userId, string code);
}
