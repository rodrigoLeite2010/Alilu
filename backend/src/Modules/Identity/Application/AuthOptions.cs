namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Opções de negócio do módulo Identity. POCO simples (sem depender de
/// <c>Microsoft.Extensions.Options</c>) para manter a Application livre
/// de pacotes NuGet — quem lê a configuração real (appsettings) e monta
/// esta instância é a Infrastructure/Api.
/// </summary>
public sealed class AuthOptions
{
    /// <summary>Validade do refresh token. Access token é sempre de vida curta (ver IJwtTokenGenerator).</summary>
    public TimeSpan RefreshTokenLifetime { get; init; } = TimeSpan.FromDays(30);
}
