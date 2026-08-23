using Microsoft.AspNetCore.Identity;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Identity;

/// <summary>
/// LiteDB üzərindən ASP.NET Core Identity Role Store implementasiyası.
///
/// BU SİNİF NƏ EDİR?
/// RoleManager{AppRole} metodları çağırıldıqda (məs: RoleExistsAsync, CreateAsync, ...),
/// Identity bu sinifin metodlarını çağırır. Biz həmin metodları LiteDB ilə implement edirik.
///
/// Rollar: Admin, Moderator, VIP, User, Teacher
/// </summary>
public class LiteDbRoleStore : IRoleStore<AppRole>
{
    private readonly LiteDbContext _db;

    public LiteDbRoleStore(LiteDbContext db)
    {
        _db = db;
    }

    public Task<IdentityResult> CreateAsync(AppRole role, CancellationToken ct)
    {
        role.Id ??= Guid.NewGuid().ToString();
        role.ConcurrencyStamp = Guid.NewGuid().ToString();
        _db.Roles.Insert(role);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<IdentityResult> UpdateAsync(AppRole role, CancellationToken ct)
    {
        role.ConcurrencyStamp = Guid.NewGuid().ToString();
        _db.Roles.Update(role);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<IdentityResult> DeleteAsync(AppRole role, CancellationToken ct)
    {
        _db.Roles.Delete(role.Id);
        return Task.FromResult(IdentityResult.Success);
    }

    public Task<AppRole?> FindByIdAsync(string roleId, CancellationToken ct)
    {
        var role = _db.Roles.FindById(roleId);
        return Task.FromResult<AppRole?>(role);
    }

    public Task<AppRole?> FindByNameAsync(string normalizedRoleName, CancellationToken ct)
    {
        var role = _db.Roles.FindOne(r => r.NormalizedName == normalizedRoleName);
        return Task.FromResult<AppRole?>(role);
    }

    public Task<string> GetRoleIdAsync(AppRole role, CancellationToken ct)
        => Task.FromResult(role.Id);

    public Task<string?> GetRoleNameAsync(AppRole role, CancellationToken ct)
        => Task.FromResult<string?>(role.Name);

    public Task SetRoleNameAsync(AppRole role, string? roleName, CancellationToken ct)
    {
        role.Name = roleName ?? string.Empty;
        return Task.CompletedTask;
    }

    public Task<string?> GetNormalizedRoleNameAsync(AppRole role, CancellationToken ct)
        => Task.FromResult<string?>(role.NormalizedName);

    public Task SetNormalizedRoleNameAsync(AppRole role, string? normalizedName, CancellationToken ct)
    {
        role.NormalizedName = normalizedName ?? string.Empty;
        return Task.CompletedTask;
    }

    public void Dispose() { /* LiteDbContext özü idarə edir */ }
}
