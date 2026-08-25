using Alilu.Shared;

namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Value Object de CNPJ: normaliza para 14 dígitos (sem máscara) e valida
/// os dígitos verificadores (algoritmo oficial da Receita Federal) — não é
/// só uma checagem de tamanho. A normalização (sem pontuação) é o que
/// permite checar duplicidade de forma confiável em
/// <c>ICondominiumRepository.ExistsByCnpjAsync</c>, do mesmo jeito que
/// <c>Email</c> normaliza para minúsculas no módulo Identity.
/// </summary>
public sealed class Cnpj : ValueObject
{
    private static readonly int[] FirstCheckDigitWeights = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
    private static readonly int[] SecondCheckDigitWeights = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };

    public string Value { get; }

    private Cnpj(string value)
    {
        Value = value;
    }

    public static Cnpj Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException("O CNPJ não pode ser vazio.");
        }

        var digits = new string(value.Where(char.IsDigit).ToArray());

        if (digits.Length != 14)
        {
            throw new DomainException("O CNPJ deve conter 14 dígitos.");
        }

        if (!HasValidCheckDigits(digits))
        {
            throw new DomainException("O CNPJ informado não é válido.");
        }

        return new Cnpj(digits);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;

    private static bool HasValidCheckDigits(string digits)
    {
        // Sequências como "00000000000000" batem na conta dos dígitos
        // verificadores mas nunca são CNPJs reais — rejeita explicitamente.
        if (digits.Distinct().Count() == 1)
        {
            return false;
        }

        var firstCheckDigit = CalculateCheckDigit(digits[..12], FirstCheckDigitWeights);
        var secondCheckDigit = CalculateCheckDigit(digits[..12] + firstCheckDigit, SecondCheckDigitWeights);

        return digits[12] - '0' == firstCheckDigit && digits[13] - '0' == secondCheckDigit;
    }

    private static int CalculateCheckDigit(string baseDigits, int[] weights)
    {
        var sum = 0;
        for (var i = 0; i < baseDigits.Length; i++)
        {
            sum += (baseDigits[i] - '0') * weights[i];
        }

        var remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }
}
