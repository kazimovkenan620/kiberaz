namespace Kiberaz.Domain.Common;

// Sessiya qaydaları — AuthService və TokenService eyni mənbədən oxuyur.
public static class SessionPolicy
{
    // Bir hesabda paralel saxlanılan cihaz sessiyalarının maksimumu; artıq olanda ən köhnəsi çıxarılır.
    public const int MaxSessionsPerUser = 5;
    public const int RefreshTokenDays = 7;
    // Sürüşən 7 gün nə qədər uzansa da bir cihaz sessiyası bu müddətdən çox yaşamır — yenidən giriş tələb olunur.
    public const int AbsoluteSessionDays = 30;
    public const int AccessTokenMinutes = 15;
    // Rotasiyadan dərhal sonra köhnə tokenlə gələn ikinci sorğu (paralel tab-lar, yenilənən səhifə) oğurluq deyil, yarışdır:
    // bu pəncərədə sessiya yenidən rotasiya olunur; pəncərədən sonra köhnə token = oğurluq əlaməti → ailə ləğv edilir.
    public const int RefreshReuseGraceSeconds = 15;
}
