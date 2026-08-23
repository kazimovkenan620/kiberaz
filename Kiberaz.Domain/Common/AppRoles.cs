namespace Kiberaz.Domain.Common;

// Sistem rollarını sabit sətir əvəzinə buraya toplayırıq ki, kod hər yerindən eyni dəyəri istifadə etsin.
// Sabit (const) istifadəsi sayəsində yazı səhvi riski sıfıra enir — "Admin" yerinə "admin" yazılsa, kompilyator xəta verir.
public static class AppRoles
{
    public const string Admin     = "Admin";
    public const string Moderator = "Moderator";
    public const string VIP       = "VIP";
    public const string User      = "User";
    public const string Teacher   = "Teacher";
}
