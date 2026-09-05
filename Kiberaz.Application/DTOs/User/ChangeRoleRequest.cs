namespace Kiberaz.Application.DTOs.User;

/// <summary>
/// PATCH /api/user/role endpoint-i üçün giriş DTO-su.
/// İstifadəçi öz hesab tipini (tələbə/müəllim) dəyişmək istədikdə göndərir.
/// </summary>
/// 
public class ChangeRoleRequest
{

    public string NewRole { get; set; } = string.Empty;

}

