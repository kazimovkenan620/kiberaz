using Kiberaz.Domain.Common;

namespace Kiberaz.Domain.Entities;

// Quiz kateqoriyası — məsələn "Network Security", "Web Security".
// Topics sahəsi köhnə versiyada JSON sətri idi; indi real massiv kimi saxlanır — NoSQL bu strukturu birbaşa anlayır.
public class QuizCategory : BaseEntity
{
    public string Title       { get; set; } = string.Empty;
    public string Icon        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // CSS rəng kodu — məsələn "#8b5cf6"; frontend kartlarda aktuallıq üçün istifadə edir.
    public string Color { get; set; } = string.Empty;

    // Kateqoriyanın əhatə etdiyi mövzular — əvvəlcə "[\"TCP/IP\"]" kimi JSON sətri idi.
    // LiteDB-nin native array dəstəyi sayəsində artıq birbaşa List<string> kimi saxlanır.
    public List<string> Topics { get; set; } = new();

    // Frontend-də kateqoriyaların göstərilmə ardıcıllığını idarə edir — kiçik rəqəm önə gəlir.
    public int SortOrder { get; set; }
}
