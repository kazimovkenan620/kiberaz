namespace Kiberaz.Domain.Common;

/// <summary>
/// İmtahan sessiyalarının biznes limitləri — tək həqiqət mənbəyi.
///
/// Validator (Application), servis (Infrastructure) və cavab DTO-ları (istifadəçiyə göstərilən
/// "bu gün N / 7") eyni rəqəmləri buradan oxuyur; rəqəm bir yerdə dəyişəndə hər tərəf uyğunlaşır.
/// Sessiya yaratmaq yalnız VIP rolu üçün açıqdır — rol yoxlaması controller-də ([Authorize]) VƏ
/// servisdə (bazadakı cari rollar) təkrar aparılır, bu sinif isə yalnız rəqəmləri saxlayır.
/// </summary>
public static class ExamPolicy
{
    /// <summary>Bir VIP hesabın bir UTC günündə yarada biləcəyi maksimum sessiya sayı.</summary>
    public const int DailySessionsPerHost = 7;

    /// <summary>Bir hesabın eyni anda saxlaya biləcəyi açıq (bağlanmamış) sessiya sayı.</summary>
    public const int MaxOpenSessionsPerHost = 50;

    public const int MinDurationMinutes = 1;
    public const int MaxDurationMinutes = 180;
    public const int MaxTitleLength = 120;

    /// <summary>Bir sessiyada seçilə biləcək kateqoriya sayı və ümumi sual sayı.</summary>
    public const int MaxCategoriesPerSession = 30;
    public const int MaxQuestionsPerSession = 50;

    /// <summary>Bir sessiyaya qoşula biləcək maksimum iştirakçı.</summary>
    public const int MaxParticipantsPerSession = 500;

    /// <summary>Sessiya kodu: "KBR-" + 16 hex simvol (8 təsadüfi bayt).</summary>
    public const string CodePrefix = "KBR-";
    public const int CodeLength = 20;
}
