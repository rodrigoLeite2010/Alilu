using Alilu.Shared;

namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Condomínio cadastrado no ALILU (plataforma multi-condomínio desde o
/// início — ver PROMPT 04). Endereço é mantido como campos simples
/// (não um Value Object único) porque, diferente do CNPJ, nenhuma regra de
/// negócio desta etapa depende de consultar/normalizar o endereço como um
/// todo — cada campo já nasce com sua própria validação pontual.
/// </summary>
public sealed class Condominium : AggregateRoot
{
    public string Name { get; private set; }
    public Cnpj Cnpj { get; private set; }
    public string Address { get; private set; }
    public string Number { get; private set; }
    public string Neighborhood { get; private set; }
    public string City { get; private set; }
    public string State { get; private set; }
    public string ZipCode { get; private set; }
    public CondominiumStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Construtor privado sem parâmetros — usado pelo EF Core para
    // materializar a entidade a partir do banco (via reflexão), nunca deve
    // ser chamado diretamente pelo código da aplicação.
#pragma warning disable CS8618
    private Condominium()
    {
    }
#pragma warning restore CS8618

    private Condominium(
        Guid id,
        string name,
        Cnpj cnpj,
        string address,
        string number,
        string neighborhood,
        string city,
        string state,
        string zipCode)
        : base(id)
    {
        Name = name;
        Cnpj = cnpj;
        Address = address;
        Number = number;
        Neighborhood = neighborhood;
        City = city;
        State = state;
        ZipCode = zipCode;
        Status = CondominiumStatus.Active;
        CreatedAt = DateTime.UtcNow;
    }

    public static Condominium Register(
        string name,
        Cnpj cnpj,
        string address,
        string number,
        string neighborhood,
        string city,
        string state,
        string zipCode)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("O nome do condomínio não pode ser vazio.");
        }

        if (name.Length > 200)
        {
            throw new DomainException("O nome do condomínio não pode ter mais de 200 caracteres.");
        }

        if (string.IsNullOrWhiteSpace(address))
        {
            throw new DomainException("O endereço não pode ser vazio.");
        }

        if (string.IsNullOrWhiteSpace(number))
        {
            throw new DomainException("O número do endereço não pode ser vazio.");
        }

        if (string.IsNullOrWhiteSpace(neighborhood))
        {
            throw new DomainException("O bairro não pode ser vazio.");
        }

        if (string.IsNullOrWhiteSpace(city))
        {
            throw new DomainException("A cidade não pode ser vazia.");
        }

        var normalizedState = state?.Trim().ToUpperInvariant() ?? string.Empty;
        if (normalizedState.Length != 2 || !normalizedState.All(char.IsLetter))
        {
            throw new DomainException("O estado deve ser a sigla de 2 letras (ex.: SP).");
        }

        var normalizedZipCode = new string((zipCode ?? string.Empty).Where(char.IsDigit).ToArray());
        if (normalizedZipCode.Length != 8)
        {
            throw new DomainException("O CEP deve conter 8 dígitos.");
        }

        return new Condominium(
            Guid.NewGuid(),
            name.Trim(),
            cnpj,
            address.Trim(),
            number.Trim(),
            neighborhood.Trim(),
            city.Trim(),
            normalizedState,
            normalizedZipCode);
    }

    public bool IsActive => Status == CondominiumStatus.Active;

    public void Deactivate() => Status = CondominiumStatus.Inactive;

    public void Activate() => Status = CondominiumStatus.Active;
}
