namespace Kiberaz.Domain.Common;

// Yükləmə kvotaları — UploadService və UploadSweeper eyni mənbədən oxuyur.
public static class UploadPolicy
{
    // Bir hesabın 24 saat ərzində yükləyə biləcəyi fayl sayı və ümumi bayt (təlim başına 2 fayl lazımdır).
    public const int PerUserDailyFiles = 20;
    public const long PerUserDailyBytes = 60L * 1024 * 1024;
    // Heç bir təlimə bağlanmayan fayl bu müddətdən sonra silinir.
    public static readonly TimeSpan OrphanTtl = TimeSpan.FromHours(24);
    public static readonly TimeSpan SweepInterval = TimeSpan.FromHours(1);
}
