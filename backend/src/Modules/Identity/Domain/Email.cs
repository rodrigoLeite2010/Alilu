using System.Text.RegularExpressions;

using Alilu.Shared;

namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Value Object de e-mail: valida o formato e normaliza para minúsculas,
/// para que "Ana@Email.com" e "ana@email.com" sejam tratados como o mesmo
/// e-mail (a checagem de duplicidade em <c>IUserRepository</c> depende
/// dessa normalização).
/// </summary>
public sealed partial class Email : ValueObject
{
    public string Value { get; }

    private Email(string value)
    {
        Value = value;
    }

    public static Email Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainException("O e-mail não pode ser vazio.");
        }

        var normalized = value.Trim().ToLowerInvariant();

        if (normalized.Length > 254 || !EmailRegex().IsMatch(normalized))
        {
            throw new DomainException("O e-mail informado não é válido.");
        }

        return new Email(normalized);
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
