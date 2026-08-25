using System.Security.Cryptography;
using System.Text;

namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Implementação de <see cref="IInvitationCodeGenerator"/> usando apenas a
/// BCL do .NET — sem nenhum pacote NuGet externo (mesmo espírito de
/// <c>RefreshTokenGenerator</c> no módulo Identity).
///
/// Diferente do refresh token (que nunca é digitado por uma pessoa), o
/// código do convite é pensado para ser repassado manualmente (WhatsApp,
/// e-mail) e digitado pelo convidado — por isso é um código curto de um
/// alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L), em vez de um token
/// longo em Base64. 10 caracteres de um alfabeto de 32 símbolos dão ~50
/// bits de entropia, adequado para um código de uso único com validade.
/// </summary>
public sealed class InvitationCodeGenerator : IInvitationCodeGenerator
{
    private const int CodeLength = 10;
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public (string RawCode, string CodeHash) Generate()
    {
        var rawCode = GenerateRawCode();
        var codeHash = Hash(rawCode);
        return (rawCode, codeHash);
    }

    public string Hash(string rawCode)
    {
        if (string.IsNullOrEmpty(rawCode))
        {
            throw new ArgumentException("O código do convite não pode ser vazio.", nameof(rawCode));
        }

        // Normaliza antes de hashear para que a comparação no momento da
        // validação seja tolerante a maiúsculas/minúsculas na digitação.
        var normalized = rawCode.Trim().ToUpperInvariant();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToBase64String(hash);
    }

    private static string GenerateRawCode()
    {
        // 256 (valores de um byte) é múltiplo exato de 32 (tamanho do
        // alfabeto) — o módulo abaixo não introduz nenhum viés estatístico.
        var randomBytes = RandomNumberGenerator.GetBytes(CodeLength);
        var buffer = new char[CodeLength];

        for (var i = 0; i < CodeLength; i++)
        {
            buffer[i] = Alphabet[randomBytes[i] % Alphabet.Length];
        }

        return new string(buffer);
    }
}
