namespace Kiberaz.Application.Interfaces;

/// <summary>Çıxış edilmiş access tokenlərin (jti) qara siyahısı. Singleton; restart-dan sağ çıxır.</summary>
public interface ITokenDenylist
{
    void Revoke(string tokenId, DateTime expiresAtUtc);
    bool IsRevoked(string tokenId);
}
