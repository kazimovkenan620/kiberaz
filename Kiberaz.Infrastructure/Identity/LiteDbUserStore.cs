using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;
using LiteDB;

namespace Kiberaz.Infrastructure.Identity;

/// <summary>
/// LiteDB üzərindən ASP.NET Core Identity User Store implementasiyası.
///
/// BU SİNİF NƏ EDİR?
/// UserManager{AppUser} metodları çağırıldıqda (məs: FindByEmailAsync, CreateAsync, ...),
/// Identity bu sinifin metodlarını çağırır. Biz həmin metodları LiteDB ilə implement edirik.
///
/// Həyata keçirilən interface-lər:
/// - IUserStore               → CRUD (Create, Read, Update, Delete)
/// - IUserPasswordStore       → PasswordHash saxlama
/// - IUserEmailStore          → Email əməliyyatları
/// - IUserRoleStore           → Rol əməliyyatları (embed edilib)
/// - IUserSecurityStampStore  → SecurityStamp (token invalidation)
/// - IUserLoginStore          → External login-lər (Google)
/// - IUserLockoutStore        → Brute force qorunması
/// - IUserPhoneNumberStore    → Telefon nömrəsi
/// - IUserTwoFactorStore      → 2FA
/// - IUserAuthenticationTokenStore → Token saxlama (email confirm, password reset)
/// - IUserClaimStore          → Claims
/// </summary>
public class LiteDbUserStore :
    IUserStore<AppUser>,
    IUserPasswordStore<AppUser>,
    IUserEmailStore<AppUser>,
    IUserRoleStore<AppUser>,
    IUserSecurityStampStore<AppUser>,
    IUserLoginStore<AppUser>,
    IUserLockoutStore<AppUser>,
    IUserPhoneNumberStore<AppUser>,
    IUserTwoFactorStore<AppUser>,
    IUserAuthenticationTokenStore<AppUser>,
    IUserClaimStore<AppUser>
{
    private readonly LiteDbContext _db;

    public LiteDbUserStore(LiteDbContext db)
    {
        _db = db;
    }

    // ═══════════════════════════════════════════════════════════
    // IUserStore — Əsas CRUD əməliyyatları
    // ═══════════════════════════════════════════════════════════

    public Task<IdentityResult> CreateAsync(AppUser user, CancellationToken ct)
    {
        user.Id ??= Guid.NewGuid().ToString();
        user.ConcurrencyStamp = Guid.NewGuid().ToString();
        _db.Users.Insert(user);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<IdentityResult> UpdateAsync(AppUser user, CancellationToken ct)
        => PersistAsync(user, ct, delete: false);

    public Task<IdentityResult> DeleteAsync(AppUser user, CancellationToken ct)
        => PersistAsync(user, ct, delete: true);

    private Task<IdentityResult> PersistAsync(AppUser user, CancellationToken ct, bool delete)
    {
        ct.ThrowIfCancellationRequested();
        ArgumentNullException.ThrowIfNull(user);

        lock (_db.UsersSyncRoot)
        {
            // A stale profile/login request must never restore a removed role, an old
            // security stamp or a revoked refresh token by overwriting the user document.
            if (!_db.Database.BeginTrans())
                throw new InvalidOperationException("Identity əməliyyatı ayrıca tranzaksiya tələb edir.");

            try
            {
                var current = _db.Users.FindById(user.Id);
                if (current is null || !string.Equals(current.ConcurrencyStamp, user.ConcurrencyStamp, StringComparison.Ordinal))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(IdentityResult.Failed(new IdentityErrorDescriber().ConcurrencyFailure()));
                }

                // Keep the caller's stamp unchanged until the write commits successfully.
                var replacement = _db.Database.Mapper.ToObject<AppUser>(_db.Database.Mapper.ToDocument(user));
                replacement.ConcurrencyStamp = Guid.NewGuid().ToString();
                var changed = delete ? _db.Users.Delete(user.Id) : _db.Users.Update(replacement);
                if (!changed)
                {
                    _db.Database.Rollback();
                    return Task.FromResult(IdentityResult.Failed(new IdentityErrorDescriber().ConcurrencyFailure()));
                }

                _db.Database.Commit();
                if (!delete)
                    user.ConcurrencyStamp = replacement.ConcurrencyStamp;
                return Task.FromResult(IdentityResult.Success);
            }
            catch
            {
                _db.Database.Rollback();
                throw;
            }
        }
    }

    public Task<AppUser?> FindByIdAsync(string userId, CancellationToken ct)
    {
        var user = _db.Users.FindById(userId);
        return Task.FromResult<AppUser?>(user);
    }

    public Task<AppUser?> FindByNameAsync(string normalizedUserName, CancellationToken ct)
    {
        var user = _db.Users.FindOne(u => u.NormalizedUserName == normalizedUserName);
        return Task.FromResult<AppUser?>(user);
    }

    public Task<string> GetUserIdAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.Id);

    public Task<string?> GetUserNameAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.UserName);

    public Task SetUserNameAsync(AppUser user, string? userName, CancellationToken ct)
    {
        user.UserName = userName;
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedUserNameAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.NormalizedUserName);

    public Task SetNormalizedUserNameAsync(AppUser user, string? normalizedName, CancellationToken ct)
    {
        user.NormalizedUserName = normalizedName;
        return Task.CompletedTask;
    }

    // ═══════════════════════════════════════════════════════════
    // IUserPasswordStore — Şifrə hash əməliyyatları
    // ═══════════════════════════════════════════════════════════

    public Task SetPasswordHashAsync(AppUser user, string? passwordHash, CancellationToken ct)
    {
        user.PasswordHash = passwordHash;
        return Task.CompletedTask;
    }

    public Task<string?> GetPasswordHashAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.PasswordHash);

    public Task<bool> HasPasswordAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(!string.IsNullOrEmpty(user.PasswordHash));

    // ═══════════════════════════════════════════════════════════
    // IUserEmailStore — E-poçt əməliyyatları
    // ═══════════════════════════════════════════════════════════

    public Task SetEmailAsync(AppUser user, string? email, CancellationToken ct)
    {
        user.Email = email;
        return Task.CompletedTask;
    }

    public Task<string?> GetEmailAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.Email);

    public Task<bool> GetEmailConfirmedAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.EmailConfirmed);

    public Task SetEmailConfirmedAsync(AppUser user, bool confirmed, CancellationToken ct)
    {
        user.EmailConfirmed = confirmed;
        return Task.CompletedTask;
    }

    public Task<AppUser?> FindByEmailAsync(string normalizedEmail, CancellationToken ct)
    {
        var user = _db.Users.FindOne(u => u.NormalizedEmail == normalizedEmail);
        return Task.FromResult<AppUser?>(user);
    }

    public Task<string?> GetNormalizedEmailAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.NormalizedEmail);

    public Task SetNormalizedEmailAsync(AppUser user, string? normalizedEmail, CancellationToken ct)
    {
        user.NormalizedEmail = normalizedEmail;
        return Task.CompletedTask;
    }

    // ═══════════════════════════════════════════════════════════
    // IUserRoleStore — Rol əməliyyatları (AppUser.Roles embed-dadır)
    // ═══════════════════════════════════════════════════════════

    public Task AddToRoleAsync(AppUser user, string roleName, CancellationToken ct)
    {
        // Normallaşdırılmış rol adı gəlir (BÖYÜK HƏRF) — biz orijinal adı tapırıq
        var role = _db.Roles.FindOne(r => r.NormalizedName == roleName.ToUpperInvariant());
        var nameToStore = role?.Name ?? roleName;

        if (!user.Roles.Contains(nameToStore, StringComparer.OrdinalIgnoreCase))
            user.Roles.Add(nameToStore);

        return Task.CompletedTask;
    }

    public Task RemoveFromRoleAsync(AppUser user, string roleName, CancellationToken ct)
    {
        user.Roles.RemoveAll(r => r.Equals(roleName, StringComparison.OrdinalIgnoreCase));
        return Task.CompletedTask;
    }

    public Task<IList<string>> GetRolesAsync(AppUser user, CancellationToken ct)
        => Task.FromResult<IList<string>>(user.Roles.ToList());

    public Task<bool> IsInRoleAsync(AppUser user, string roleName, CancellationToken ct)
        => Task.FromResult(user.Roles.Any(r => r.Equals(roleName, StringComparison.OrdinalIgnoreCase)));

    public Task<IList<AppUser>> GetUsersInRoleAsync(string roleName, CancellationToken ct)
    {
        var role = _db.Roles.FindOne(r => r.NormalizedName == roleName.ToUpperInvariant());
        var nameToFind = role?.Name ?? roleName;

        var users = _db.Users.FindAll()
            .Where(u => u.Roles.Any(r => r.Equals(nameToFind, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        return Task.FromResult<IList<AppUser>>(users);
    }

    // ═══════════════════════════════════════════════════════════
    // IUserSecurityStampStore — SecurityStamp (token invalidation)
    // ═══════════════════════════════════════════════════════════

    public Task SetSecurityStampAsync(AppUser user, string stamp, CancellationToken ct)
    {
        user.SecurityStamp = stamp;
        return Task.CompletedTask;
    }

    public Task<string?> GetSecurityStampAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.SecurityStamp);

    // ═══════════════════════════════════════════════════════════
    // IUserLoginStore — External login-lər (Google OAuth)
    // ═══════════════════════════════════════════════════════════

    public Task AddLoginAsync(AppUser user, UserLoginInfo login, CancellationToken ct)
    {
        var existing = user.Logins.FirstOrDefault(l =>
            l.LoginProvider == login.LoginProvider && l.ProviderKey == login.ProviderKey);

        if (existing is null)
        {
            user.Logins.Add(new AppUserLogin
            {
                LoginProvider = login.LoginProvider,
                ProviderKey = login.ProviderKey,
                ProviderDisplayName = login.ProviderDisplayName
            });
        }
        return Task.CompletedTask;
    }

    public Task RemoveLoginAsync(AppUser user, string loginProvider, string providerKey, CancellationToken ct)
    {
        user.Logins.RemoveAll(l => l.LoginProvider == loginProvider && l.ProviderKey == providerKey);
        return Task.CompletedTask;
    }

    public Task<IList<UserLoginInfo>> GetLoginsAsync(AppUser user, CancellationToken ct)
    {
        var logins = user.Logins
            .Select(l => new UserLoginInfo(l.LoginProvider, l.ProviderKey, l.ProviderDisplayName))
            .ToList();
        return Task.FromResult<IList<UserLoginInfo>>(logins);
    }

    public Task<AppUser?> FindByLoginAsync(string loginProvider, string providerKey, CancellationToken ct)
    {
        // FindOne() ilə embedded list içindəki compound && predikati LiteDB 5-də NotSupportedException atır.
        // FindAll() + FirstOrDefault() in-memory filtrləyir — eyni nəticə, amma təhlükəsiz.
        var user = _db.Users.FindAll()
            .FirstOrDefault(u => u.Logins.Any(l => l.LoginProvider == loginProvider && l.ProviderKey == providerKey));
        return Task.FromResult<AppUser?>(user);
    }

    // ═══════════════════════════════════════════════════════════
    // IUserLockoutStore — Brute force qorunması
    // ═══════════════════════════════════════════════════════════

    public Task<DateTimeOffset?> GetLockoutEndDateAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.LockoutEnd);

    public Task SetLockoutEndDateAsync(AppUser user, DateTimeOffset? lockoutEnd, CancellationToken ct)
    {
        user.LockoutEnd = lockoutEnd;
        return Task.CompletedTask;
    }

    public Task<int> IncrementAccessFailedCountAsync(AppUser user, CancellationToken ct)
    {
        user.AccessFailedCount++;
        return Task.FromResult(user.AccessFailedCount);
    }

    public Task ResetAccessFailedCountAsync(AppUser user, CancellationToken ct)
    {
        user.AccessFailedCount = 0;
        return Task.CompletedTask;
    }

    public Task<int> GetAccessFailedCountAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.AccessFailedCount);

    public Task<bool> GetLockoutEnabledAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.LockoutEnabled);

    public Task SetLockoutEnabledAsync(AppUser user, bool enabled, CancellationToken ct)
    {
        user.LockoutEnabled = enabled;
        return Task.CompletedTask;
    }

    // ═══════════════════════════════════════════════════════════
    // IUserPhoneNumberStore — Telefon nömrəsi
    // ═══════════════════════════════════════════════════════════

    public Task SetPhoneNumberAsync(AppUser user, string? phoneNumber, CancellationToken ct)
    {
        user.PhoneNumber = phoneNumber;
        return Task.CompletedTask;
    }

    public Task<string?> GetPhoneNumberAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.PhoneNumber);

    public Task<bool> GetPhoneNumberConfirmedAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.PhoneNumberConfirmed);

    public Task SetPhoneNumberConfirmedAsync(AppUser user, bool confirmed, CancellationToken ct)
    {
        user.PhoneNumberConfirmed = confirmed;
        return Task.CompletedTask;
    }

    // ═══════════════════════════════════════════════════════════
    // IUserTwoFactorStore — İki faktorlu autentifikasiya
    // ═══════════════════════════════════════════════════════════

    public Task SetTwoFactorEnabledAsync(AppUser user, bool enabled, CancellationToken ct)
    {
        user.TwoFactorEnabled = enabled;
        return Task.CompletedTask;
    }

    public Task<bool> GetTwoFactorEnabledAsync(AppUser user, CancellationToken ct)
        => Task.FromResult(user.TwoFactorEnabled);

    // ═══════════════════════════════════════════════════════════
    // IUserAuthenticationTokenStore — Token saxlama
    // (Email Confirmation, Password Reset token-ları burada saxlanır)
    // ═══════════════════════════════════════════════════════════

    public Task SetTokenAsync(AppUser user, string loginProvider, string name, string? value, CancellationToken ct)
    {
        var existing = user.Tokens.FirstOrDefault(t =>
            t.LoginProvider == loginProvider && t.Name == name);

        if (existing is not null)
            existing.Value = value;
        else
            user.Tokens.Add(new AppUserToken
            {
                LoginProvider = loginProvider,
                Name = name,
                Value = value
            });

        return Task.CompletedTask;
    }

    public Task RemoveTokenAsync(AppUser user, string loginProvider, string name, CancellationToken ct)
    {
        user.Tokens.RemoveAll(t => t.LoginProvider == loginProvider && t.Name == name);
        return Task.CompletedTask;
    }

    public Task<string?> GetTokenAsync(AppUser user, string loginProvider, string name, CancellationToken ct)
    {
        var token = user.Tokens.FirstOrDefault(t =>
            t.LoginProvider == loginProvider && t.Name == name);
        return Task.FromResult(token?.Value);
    }

    // ═══════════════════════════════════════════════════════════
    // IUserClaimStore — Claims əməliyyatları
    // ═══════════════════════════════════════════════════════════

    public Task<IList<Claim>> GetClaimsAsync(AppUser user, CancellationToken ct)
    {
        var claims = user.Claims
            .Select(c => new Claim(c.Type, c.Value))
            .ToList();
        return Task.FromResult<IList<Claim>>(claims);
    }

    public Task AddClaimsAsync(AppUser user, IEnumerable<Claim> claims, CancellationToken ct)
    {
        foreach (var claim in claims)
        {
            user.Claims.Add(new AppUserClaim
            {
                Type = claim.Type,
                Value = claim.Value
            });
        }

        return Task.CompletedTask;
    }

    public Task ReplaceClaimAsync(AppUser user, Claim claim, Claim newClaim, CancellationToken ct)
    {
        foreach (var existing in user.Claims.Where(c => c.Type == claim.Type && c.Value == claim.Value))
        {
            existing.Type = newClaim.Type;
            existing.Value = newClaim.Value;
        }

        return Task.CompletedTask;
    }

    public Task RemoveClaimsAsync(AppUser user, IEnumerable<Claim> claims, CancellationToken ct)
    {
        foreach (var claim in claims)
        {
            user.Claims.RemoveAll(c => c.Type == claim.Type && c.Value == claim.Value);
        }

        return Task.CompletedTask;
    }

    public Task<IList<AppUser>> GetUsersForClaimAsync(Claim claim, CancellationToken ct)
    {
        var users = _db.Users.FindAll()
            .Where(u => u.Claims.Any(c => c.Type == claim.Type && c.Value == claim.Value))
            .ToList();
        return Task.FromResult<IList<AppUser>>(users);
    }

    // ═══════════════════════════════════════════════════════════
    // IQueryableUserStore — Users sorğulanabilir property
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// Users.AsQueryable() — AuthService-də .FirstOrDefaultAsync istifadə edilir.
    /// LiteDB-nin bütün istifadəçilərini yükləyib LINQ vasitəsilə filtrləyirik.
    /// </summary>
    public IQueryable<AppUser> Users
        => _db.Users.FindAll().AsQueryable();

    // ═══════════════════════════════════════════════════════════
    // IDisposable
    // ═══════════════════════════════════════════════════════════

    public void Dispose() { /* LiteDbContext özü idarə edir */ }
}
