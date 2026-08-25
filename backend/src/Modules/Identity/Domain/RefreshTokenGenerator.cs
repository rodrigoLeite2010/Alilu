using System.Security.Cryptography;
using System.Text;

namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Implementação de <see cref="IRefreshTokenGenerator"/> usando apenas a
/// BCL do .NET (<see cref="RandomNumberGenerator"/> + SHA-256) — sem
/// nenhum pacote NuGet externo.
///
/// Diferente de senha, um refresh token já nasce com alta entropia
/// (256 bits aleatórios), então um hash rápido (SHA-256) é apropriado —
/// não precisa do custo computacional de um PBKDF2 como em
/// <see cref="PasswordHasher"/>.
/// </summary>
public sealed class RefreshTokenGenerator : IRefreshTokenGenerator
{
    private const int RawTokenSizeBytes = 32;

    public (string RawToken, string TokenHash) Generate()
    {
        var rawBytes = RandomNumberGenerator.GetBytes(RawTokenSizeBytes);
        var rawToken = Base64UrlEncode(rawBytes);
        var tokenHash = Hash(rawToken);
        return (rawToken, tokenHash);
    }

    public string Hash(string rawToken)
    {
        if (string.IsNullOrEmpty(rawToken))
        {
            throw new ArgumentException("O refresh token não pode ser vazio.", nameof(rawToken));
        }

        var bytes = Encoding.UTF8.GetBytes(rawToken);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
