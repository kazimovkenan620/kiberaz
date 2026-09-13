namespace Kiberaz.Domain.Common;

/// <summary>
/// HTTP sorğusu, panel və konfiqurasiya ilə dəyişdirilə bilməyən sistem hesabları.
/// Administrator kimliyi burada qəsdən sabitdir: tətbiqdə yalnız bu e-poçt Admin ola bilər.
/// </summary>
public static class SystemAccounts
{
    public const string AdministratorEmail = "kiberaz.az@gmail.com";
    public const string NormalizedAdministratorEmail = "KIBERAZ.AZ@GMAIL.COM";

    public static bool IsAdministratorEmail(string? email)
        => !string.IsNullOrWhiteSpace(email) &&
           string.Equals(email.Trim(), AdministratorEmail, StringComparison.OrdinalIgnoreCase);
}
