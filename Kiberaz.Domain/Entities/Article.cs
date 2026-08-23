using Kiberaz.Domain.Common;

namespace Kiberaz.Domain.Entities;

/// <summary>
/// Bilgi bazası məqaləsi.
///
/// NoSQL NOT: Navigation property yoxdur.
/// Category məlumatı lazım olduqda Categories collection-dan
/// CategoryId ilə ayrıca sorğu edilir.
/// </summary>
public class Article : BaseEntity
{
    /// <summary>Məqalənin başlığı</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Məqalənin əsas mətni (Markdown və ya HTML)</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>Məqalənin aid olduğu kateqoriya ID-si (Reference)</summary>
    public int CategoryId { get; set; }
}
