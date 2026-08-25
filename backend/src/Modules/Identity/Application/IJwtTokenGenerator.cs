using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Porta para geração do access token (JWT). Implementada em
/// Infrastructure usando uma biblioteca de JWT — depende de pacote NuGet
/// externo, por isso não fica em Domain como <see cref="IPasswordHasher"/>
/// ou <see cref="IRefreshTokenGenerator"/> (que só usam a BCL).
/// </summary>
public interface IJwtTokenGenerator
{
    (string AccessToken, DateTime ExpiresAtUtc) GenerateAccessToken(User user);
}
