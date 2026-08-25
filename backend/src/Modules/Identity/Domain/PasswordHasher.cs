using System.Security.Cryptography;

namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Implementação de <see cref="IPasswordHasher"/> usando PBKDF2-HMACSHA256
/// (o mesmo algoritmo usado internamente pelo ASP.NET Core Identity) via
/// <see cref="Rfc2898DeriveBytes"/> — disponível na BCL do .NET, sem
/// nenhum pacote NuGet externo.
///
/// Formato armazenado (Base64 de): [1 byte versão][4 bytes iterações
/// big-endian][16 bytes salt][32 bytes subkey].
/// </summary>
public sealed class PasswordHasher : IPasswordHasher
{
    private const byte FormatVersion = 1;
    private const int SaltSizeBytes = 16;
    private const int SubkeySizeBytes = 32;
    private const int Iterations = 210_000; // recomendação OWASP (2023+) para PBKDF2-HMACSHA256

    public string Hash(string plainTextPassword)
    {
        if (string.IsNullOrEmpty(plainTextPassword))
        {
            throw new ArgumentException("A senha não pode ser vazia.", nameof(plainTextPassword));
        }

        var salt = RandomNumberGenerator.GetBytes(SaltSizeBytes);
        var subkey = Rfc2898DeriveBytes.Pbkdf2(
            plainTextPassword,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            SubkeySizeBytes);

        var result = new byte[1 + 4 + SaltSizeBytes + SubkeySizeBytes];
        result[0] = FormatVersion;
        WriteBigEndian(Iterations, result.AsSpan(1, 4));
        salt.CopyTo(result.AsSpan(5, SaltSizeBytes));
        subkey.CopyTo(result.AsSpan(5 + SaltSizeBytes, SubkeySizeBytes));

        return Convert.ToBase64String(result);
    }

    public bool Verify(string plainTextPassword, string passwordHash)
    {
        if (string.IsNullOrEmpty(plainTextPassword) || string.IsNullOrEmpty(passwordHash))
        {
            return false;
        }

        byte[] decoded;
        try
        {
            decoded = Convert.FromBase64String(passwordHash);
        }
        catch (FormatException)
        {
            return false;
        }

        if (decoded.Length != 1 + 4 + SaltSizeBytes + SubkeySizeBytes || decoded[0] != FormatVersion)
        {
            return false;
        }

        var iterations = ReadBigEndian(decoded.AsSpan(1, 4));
        var salt = decoded.AsSpan(5, SaltSizeBytes).ToArray();
        var expectedSubkey = decoded.AsSpan(5 + SaltSizeBytes, SubkeySizeBytes).ToArray();

        var actualSubkey = Rfc2898DeriveBytes.Pbkdf2(
            plainTextPassword,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            SubkeySizeBytes);

        return CryptographicOperations.FixedTimeEquals(actualSubkey, expectedSubkey);
    }

    private static void WriteBigEndian(int value, Span<byte> destination)
    {
        destination[0] = (byte)(value >> 24);
        destination[1] = (byte)(value >> 16);
        destination[2] = (byte)(value >> 8);
        destination[3] = (byte)value;
    }

    private static int ReadBigEndian(ReadOnlySpan<byte> source)
    {
        return (source[0] << 24) | (source[1] << 16) | (source[2] << 8) | source[3];
    }
}
