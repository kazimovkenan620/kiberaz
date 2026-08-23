using Microsoft.AspNetCore.Identity;

namespace Kiberaz.Infrastructure.Identity;

public class AzIdentityErrorDescriber : IdentityErrorDescriber
{
    public override IdentityError DefaultError()
    {
        return new IdentityError { Code = nameof(DefaultError), Description = "Bilinməyən bir xəta baş verdi." };
    }

    public override IdentityError ConcurrencyFailure()
    {
        return new IdentityError { Code = nameof(ConcurrencyFailure), Description = "Eyni vaxtda dəyişiklik cəhdi. Zəhmət olmasa yenidən cəhd edin." };
    }

    public override IdentityError PasswordMismatch()
    {
        return new IdentityError { Code = nameof(PasswordMismatch), Description = "Yanlış şifrə." };
    }

    public override IdentityError InvalidToken()
    {
        return new IdentityError { Code = nameof(InvalidToken), Description = "Yararsız token." };
    }

    public override IdentityError LoginAlreadyAssociated()
    {
        return new IdentityError { Code = nameof(LoginAlreadyAssociated), Description = "Bu istifadəçi artıq başqa bir hesabla əlaqəlidir." };
    }

    public override IdentityError InvalidUserName(string? userName)
    {
        return new IdentityError { Code = nameof(InvalidUserName), Description = $"'{userName}' istifadəçi adı keçərsizdir. Yalnız hərf və rəqəmlər daxil edə bilərsiniz." };
    }

    public override IdentityError InvalidEmail(string? email)
    {
        return new IdentityError { Code = nameof(InvalidEmail), Description = $"'{email}' e-poçt ünvanı keçərsizdir." };
    }

    public override IdentityError DuplicateUserName(string userName)
    {
        return new IdentityError { Code = nameof(DuplicateUserName), Description = $"'{userName}' istifadəçi adı artıq mövcuddur." };
    }

    public override IdentityError DuplicateEmail(string email)
    {
        return new IdentityError { Code = nameof(DuplicateEmail), Description = $"'{email}' e-poçt ünvanı artıq istifadə olunur." };
    }

    public override IdentityError InvalidRoleName(string? role)
    {
        return new IdentityError { Code = nameof(InvalidRoleName), Description = $"'{role}' rol adı keçərsizdir." };
    }

    public override IdentityError DuplicateRoleName(string role)
    {
        return new IdentityError { Code = nameof(DuplicateRoleName), Description = $"'{role}' rol adı artıq mövcuddur." };
    }

    public override IdentityError UserAlreadyHasPassword()
    {
        return new IdentityError { Code = nameof(UserAlreadyHasPassword), Description = "İstifadəçinin artıq şifrəsi var." };
    }

    public override IdentityError UserLockoutNotEnabled()
    {
        return new IdentityError { Code = nameof(UserLockoutNotEnabled), Description = "Bu istifadəçi üçün kilidləmə aktiv deyil." };
    }

    public override IdentityError UserAlreadyInRole(string role)
    {
        return new IdentityError { Code = nameof(UserAlreadyInRole), Description = $"İstifadəçi onsuz da '{role}' rolundadır." };
    }

    public override IdentityError UserNotInRole(string role)
    {
        return new IdentityError { Code = nameof(UserNotInRole), Description = $"İstifadəçi '{role}' rolunda deyil." };
    }

    public override IdentityError PasswordTooShort(int length)
    {
        return new IdentityError { Code = nameof(PasswordTooShort), Description = $"Şifrə ən azı {length} simvoldan ibarət olmalıdır." };
    }

    public override IdentityError PasswordRequiresNonAlphanumeric()
    {
        return new IdentityError { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "Şifrədə ən azı bir xüsusi simvol olmalıdır." };
    }

    public override IdentityError PasswordRequiresDigit()
    {
        return new IdentityError { Code = nameof(PasswordRequiresDigit), Description = "Şifrədə ən azı bir rəqəm ('0'-'9') olmalıdır." };
    }

    public override IdentityError PasswordRequiresLower()
    {
        return new IdentityError { Code = nameof(PasswordRequiresLower), Description = "Şifrədə ən azı bir kiçik hərf ('a'-'z') olmalıdır." };
    }

    public override IdentityError PasswordRequiresUpper()
    {
        return new IdentityError { Code = nameof(PasswordRequiresUpper), Description = "Şifrədə ən azı bir böyük hərf ('A'-'Z') olmalıdır." };
    }
}
