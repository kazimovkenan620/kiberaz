namespace Kiberaz.Application.DTOs.Quiz;

/// <summary>
/// Admin panelindəki kateqoriya sətri — ictimai <see cref="QuizCategoryResponse"/>-dən fərqli olaraq
/// məxfi (imtahan) sual sayını da göstərir. Yalnız Admin roluna qaytarılır.
/// </summary>
public class AdminQuizCategoryResponse
{
    public int    Id          { get; set; }
    public string Title       { get; set; } = string.Empty;
    public string Icon        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color       { get; set; } = string.Empty;
    public List<string> Topics { get; set; } = new();
    public int    SortOrder   { get; set; }

    /// <summary>Ana səhifədəki quizdə görünən suallar.</summary>
    public int    PublicQuestionCount { get; set; }

    /// <summary>Yalnız imtahan sessiyalarında istifadə olunan məxfi suallar.</summary>
    public int    ExamQuestionCount   { get; set; }

    public int    TotalQuestionCount  { get; set; }

    /// <summary>Bu kateqoriyada ən azı bir sual cavablamış unikal istifadəçi sayı (gizli hesablar xaric).</summary>
    public int    ParticipantCount    { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>Soft-delete vəziyyəti — "Silinmişlər" siyahısında bərpa üçün.</summary>
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>Kateqoriya düzəlişi — sahələr yaratma sorğusu ilə eynidir.</summary>
public class UpdateQuizCategoryRequest : CreateQuizCategoryRequest
{
}

/// <summary>
/// Admin sual görünüşü: düzgün açar və izahlar da daxildir.
/// Bu proyeksiya heç vaxt Admin rolundan kənara verilmir — əks halda sual bankı sızardı.
/// </summary>
public class AdminQuizQuestionResponse
{
    public int    Id            { get; set; }
    public int    CategoryId    { get; set; }
    public string CategoryTitle { get; set; } = string.Empty;
    public string Difficulty    { get; set; } = string.Empty;
    public string Question      { get; set; } = string.Empty;
    public string CorrectKey    { get; set; } = string.Empty;
    public bool   IsExamOnly    { get; set; }
    public List<QuizOptionResponse> Options { get; set; } = new();
    public DateTime  CreatedAt  { get; set; }
    public DateTime? UpdatedAt  { get; set; }

    /// <summary>Bu suala verilmiş cavab sayı — silməzdən əvvəl təsirini görmək üçün.</summary>
    public int    AnswerCount   { get; set; }

    /// <summary>Soft-delete vəziyyəti — "Silinmişlər" siyahısında bərpa üçün.</summary>
    public bool      IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

/// <summary>Səhifələnmiş sual siyahısı — bank böyüdükcə cavab ölçüsü sabit qalır.</summary>
public class AdminQuestionPageResponse
{
    public List<AdminQuizQuestionResponse> Items { get; set; } = new();

    /// <summary>Filtrə uyğun ümumi sual sayı (səhifədən asılı olmayaraq).</summary>
    public int Total { get; set; }
    public int Skip  { get; set; }
    public int Take  { get; set; }
}

/// <summary>
/// Sual düzəlişi. <c>IsExamOnly</c> QƏSDƏN yoxdur: ictimai bankda görünmüş sualın mətni
/// artıq açıqdır, onu məxfi imtahan bankına "çevirmək" sızmış sualla imtahan qurmaq deməkdir.
/// Bank dəyişmək üçün sual silinib yenidən yaradılmalıdır.
/// </summary>
public class UpdateQuizQuestionRequest
{
    public int    CategoryId { get; set; }
    public string Difficulty { get; set; } = string.Empty;
    public string Question   { get; set; } = string.Empty;
    public string CorrectKey { get; set; } = string.Empty;
    public List<CreateQuizOptionRequest> Options { get; set; } = new();
}
