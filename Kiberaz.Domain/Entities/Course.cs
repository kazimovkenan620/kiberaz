using Kiberaz.Domain.Common;
using Kiberaz.Domain.Enums;

namespace Kiberaz.Domain.Entities;

/// <summary>
/// Platformada reklam olunan kurs entity-si.
/// Müəllimlər kurslarını əlavə edir, moderasiyadan keçdikdən sonra HeroSlider-da görünür.
///
/// ÖNƏMLİ NoSQL Dəyişikliyi:
/// SyllabusTopics: JSON string → List{string} (native NoSQL array)
/// Əvvəl: SyllabusTopics = "[\"Giriş\",\"Nmap\"]" (string kimi saxlanırdı)
/// İndi:  SyllabusTopics = ["Giriş", "Nmap"]    (real array, serialize/deserialize lazım deyil)
/// </summary>
public class Course : BaseEntity
{
    // ─── MÜƏLLİM MƏLUMATLARI ────────────────────────────────────
    /// <summary>Müəllimin tam adı</summary>
    public string InstructorName { get; set; } = string.Empty;

    /// <summary>Müəllimin vəzifəsi (məs: Senior Security Engineer)</summary>
    public string InstructorRole { get; set; } = string.Empty;

    /// <summary>Müəllimin şirkəti</summary>
    public string? InstructorCompany { get; set; }

    /// <summary>Müəllim şəklinin URL-i</summary>
    public string? InstructorPhotoUrl { get; set; }

    /// <summary>LinkedIn profil URL-i</summary>
    public string? LinkedInUrl { get; set; }

    /// <summary>GitHub profil URL-i</summary>
    public string? GitHubUrl { get; set; }

    /// <summary>Əlaqə e-poçtu</summary>
    public string? ContactEmail { get; set; }

    /// <summary>Əlaqə telefon nömrəsi</summary>
    public string? ContactPhone { get; set; }

    // ─── KURS MƏLUMATLARI ────────────────────────────────────────
    /// <summary>Kursun başlığı</summary>
    public string CourseTitle { get; set; } = string.Empty;

    /// <summary>Üst başlıq (kicker) — məs: "YENİ QRUP: 15 OKTYABR"</summary>
    public string? Kicker { get; set; }

    /// <summary>Kursun ətraflı açıqlaması</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Kursun müddəti (məs: "8 həftə")</summary>
    public string Duration { get; set; } = string.Empty;

    /// <summary>Səviyyə (məs: "Başlanğıc → Orta")</summary>
    public string Level { get; set; } = string.Empty;

    /// <summary>Tədris dili</summary>
    public string Language { get; set; } = "Azərbaycan dili";

    /// <summary>
    /// Proqram mövzuları — REAL ARRAY (artıq JSON string deyil).
    /// NoSQL-in üstünlüyü: serialize/deserialize lazım deyil.
    /// Məsələn: ["Giriş", "Nmap istifadəsi", "Metasploit"]
    /// </summary>
    public List<string> SyllabusTopics { get; set; } = new();

    /// <summary>Sillabus PDF faylının URL-i</summary>
    public string? SyllabusFileUrl { get; set; }

    /// <summary>UI-da istifadə olunan CSS accent rəng dəyişəni (məs: "--brand-primary")</summary>
    public string AccentColor { get; set; } = "--brand-primary";

    // ─── ADMİN PANELİ SAHƏLƏRİ ───────────────────────────────────
    /// <summary>
    /// Mövzu kateqoriyası (məs: "Web Security"). Admin panelindən əlavə edilən
    /// təlimlərdə doldurulur; ictimai formadan gələnlərdə null qalır.
    /// LiteDB sxemsizdir — köhnə sənədlərdə bu sahə sadəcə mövcud olmayacaq, migration lazım deyil.
    /// </summary>
    public string? Category { get; set; }

    /// <summary>Qeydiyyat / ətraflı məlumat linki (admin panelindən əlavə edilir).</summary>
    public string? Link { get; set; }

    // ─── MODERASİYA ──────────────────────────────────────────────
    /// <summary>Kursun moderasiya statusu</summary>
    public CourseStatus Status { get; set; } = CourseStatus.Approved;

    /// <summary>Kursu göndərən istifadəçinin ID-si (nullable — anonim göndərmə mümkündür)</summary>
    public string? SubmittedByUserId { get; set; }
}
