using Kiberaz.Application.DTOs.Quiz;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Quiz xidmət interfeysi.
/// Kateqoriyalar və suallar üçün CRUD əməliyyatlarını təyin edir.
/// </summary>
public interface IQuizService
{
    /// <summary>Bütün quiz kateqoriyalarını sual sayı ilə birlikdə qaytarır</summary>
    Task<List<QuizCategoryResponse>> GetCategoriesAsync();

    /// <summary>
    /// Verilən kateqoriya üzrə sualları qaytarır.
    /// </summary>
    /// <param name="categoryId">Kateqoriya ID-si</param>
    /// <param name="difficulty">Çətinlik filteri (null = Qarışıq/hamısı)</param>
    /// <param name="count">Qaytarılacaq sual sayı (default: 10)</param>
    Task<List<QuizQuestionPublicResponse>> GetQuestionsAsync(int categoryId, string? difficulty = null, int count = 10);

    /// <summary>
    /// İstifadəçinin cavabını server tərəfdə yoxlayır.
    /// userId verilibsə nəticə DB-yə yazılır (statistika üçün).
    /// </summary>
    Task<SubmitAnswerResponse> SubmitAnswerAsync(SubmitAnswerRequest request, string? userId = null);

    /// <summary>Yeni sual yaradır (Admin panel üçün)</summary>
    Task<QuizQuestionResponse> CreateQuestionAsync(CreateQuizQuestionRequest request);

    /// <summary>Sualı silir — soft delete (Admin panel üçün)</summary>
    Task<bool> DeleteQuestionAsync(int questionId);

    /// <summary>Yeni quiz kateqoriyası yaradır (Admin panel üçün)</summary>
    Task<QuizCategoryResponse> CreateCategoryAsync(CreateQuizCategoryRequest request);

    /// <summary>Kateqoriyanı silir — soft delete (Admin panel üçün)</summary>
    Task<bool> DeleteCategoryAsync(int categoryId);

    /// <summary>
    /// Liderlik lövhəsi — QuizResults üzərindən canlı hesablanır.
    /// </summary>
    /// <param name="period">"weekly" | "monthly" | "all" (default: all)</param>
    /// <param name="categoryId">Yalnız bu kateqoriya üzrə; null = bütün kateqoriyalar</param>
    /// <param name="limit">Qaytarılacaq sətir sayı</param>
    Task<List<LeaderboardEntryResponse>> GetLeaderboardAsync(string? period, int? categoryId, int limit);
}
