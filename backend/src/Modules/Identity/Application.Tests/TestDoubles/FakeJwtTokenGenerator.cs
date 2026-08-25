using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application.Tests.TestDoubles;

/// <summary>
/// Fake de <see cref="IJwtTokenGenerator"/> — a implementação real
/// (Infrastructure/Security/JwtTokenGenerator.cs) usa
/// System.IdentityModel.Tokens.Jwt, um pacote NuGet externo que não
/// pertence à Application e não precisa ser exercitado aqui: o que os
/// testes de <see cref="AuthService"/> verificam é que ele É chamado, não
/// como o JWT é montado por dentro.
/// </summary>
public sealed class FakeJwtTokenGenerator : IJwtTokenGenerator
{
    public int CallCount { get; private set; }

    public (string AccessToken, DateTime ExpiresAtUtc) GenerateAccessToken(User user)
    {
        CallCount++;
        return ($"fake-jwt-for-{user.Id}-{CallCount}", DateTime.UtcNow.AddMinutes(15));
    }
}
