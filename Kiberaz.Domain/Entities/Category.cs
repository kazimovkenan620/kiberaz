using System.Collections.Generic;
using Kiberaz.Domain.Common;

namespace Kiberaz.Domain.Entities
{
    public class Category : BaseEntity
    {
        // Kateqoriyanın adı (Məs: Web Security)
        public string Title { get; set; } = string.Empty;

        // Kateqoriya haqqında qısa məlumat
        public string Description { get; set; } = string.Empty;

        // UI-da göstərmək üçün icon (emoji və ya class adı)
        public string Icon { get; set; } = string.Empty;

        // UI-da göstərmək üçün CSS rəng kodu (Məs: #3b82f6)
        public string Color { get; set; } = string.Empty;

        // Çətinlik dərəcəsi: Başlanğıc, Orta, İrəliləmiş
        public string Difficulty { get; set; } = string.Empty;

        // NOT: NoSQL-də navigation property yoxdur.
        // Məqalələrə Articles collection-dan ayrıca sorğu ilə çatılır.
    }
}
