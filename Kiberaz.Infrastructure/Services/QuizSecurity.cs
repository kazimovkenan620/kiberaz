using System.Text;
using Kiberaz.Domain.Entities;

namespace Kiberaz.Infrastructure.Services;

public static class QuizSecurity
{
    public static string NormalizeQuestion(string text) => string.Join(' ',
        text.Normalize(NormalizationForm.FormKC).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        .ToUpperInvariant();

    // Deduplicate before period filtering. Preserve history, score the earliest answer only.
    public static IEnumerable<QuizResult> ScoredResults(IEnumerable<QuizResult> results) => results
        .GroupBy(r => (r.UserId, r.QuestionId))
        .Select(g => g.OrderBy(r => r.AnsweredAt).ThenBy(r => r.Id).First());
}
