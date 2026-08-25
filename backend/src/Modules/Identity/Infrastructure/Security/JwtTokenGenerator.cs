using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Alilu.Modules.Identity.Infrastructure.Security;

/// <summary>
/// Implementação de <see cref="IJwtTokenGenerator"/> usando
/// <c>System.IdentityModel.Tokens.Jwt</c> (biblioteca oficial da
/// Microsoft) — diferente do hash de senha/refresh token, JWT não é
/// "hand-rolled": assinatura e serialização do token seguem a RFC 7519
/// via biblioteca testada.
/// </summary>
public sealed class JwtTokenGenerator(IOptions<JwtOptions> jwtOptions) : IJwtTokenGenerator
{
    public (string AccessToken, DateTime ExpiresAtUtc) GenerateAccessToken(User user)
    {
        var options = jwtOptions.Value;

        if (string.IsNullOrWhiteSpace(options.Secret))
        {
            throw new InvalidOperationException(
                "A configuração 'Jwt:Secret' não foi definida. Configure-a no appsettings (ou em user-secrets/variável de ambiente) antes de emitir tokens.");
        }

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(options.AccessTokenLifetimeMinutes);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email.Value),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Secret));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

        return (accessToken, expiresAtUtc);
    }
}
