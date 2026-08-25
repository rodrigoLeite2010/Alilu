namespace Alilu.Modules.Identity.Infrastructure.Security;

/// <summary>
/// Configuração do access token JWT, lida da seção "Jwt" do appsettings
/// (ver <see cref="DependencyInjection.AddIdentityModule"/>).
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Chave simétrica usada para assinar o token (HMAC-SHA256). Nunca deve ser um valor fraco/curto em produção.</summary>
    public string Secret { get; init; } = string.Empty;

    public string Issuer { get; init; } = "Alilu";

    public string Audience { get; init; } = "Alilu";

    /// <summary>Access token é sempre de vida curta — refresh token (ver AuthOptions) é quem tem vida longa.</summary>
    public int AccessTokenLifetimeMinutes { get; init; } = 15;
}
