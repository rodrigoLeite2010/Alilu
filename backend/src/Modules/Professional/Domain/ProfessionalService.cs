using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Vínculo entre um <see cref="Professional"/> e uma
/// <see cref="ServiceCategory"/> que ele oferece (PROMPT 06, React Native:
/// "selecionar serviços"). Um mesmo profissional pode ter vários serviços
/// (ex.: um profissional que é Jardineiro e Piscineiro).
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>Professional</c>/<c>ServiceCategory</c>, só os Ids como valores
/// simples, mesma decisão de <c>CondominiumUnit</c> em relação a
/// <c>Condominium</c> (módulo Condominium) e de <c>ProfessionalCondominium</c>
/// logo abaixo — mesmo as três entidades pertencendo a este módulo, o
/// projeto evita navegação EF entre agregados para manter cada um
/// independente e testável isoladamente (ver ARCHITECTURE.md).
/// </summary>
public sealed class ProfessionalService : AggregateRoot
{
    public Guid ProfessionalId { get; private set; }
    public Guid ServiceCategoryId { get; private set; }
    public string? Description { get; private set; }
    public bool Active { get; private set; }

#pragma warning disable CS8618
    private ProfessionalService()
    {
    }
#pragma warning restore CS8618

    private ProfessionalService(Guid id, Guid professionalId, Guid serviceCategoryId, string? description)
        : base(id)
    {
        ProfessionalId = professionalId;
        ServiceCategoryId = serviceCategoryId;
        Description = description;
        Active = true;
    }

    /// <summary>
    /// Vincula um serviço ao profissional. A existência/atividade da
    /// categoria e a não-duplicidade (mesmo profissional + mesma categoria,
    /// já ativo) são responsabilidade da Application antes de persistir —
    /// esta entidade, isolada, não tem como validar isso.
    /// </summary>
    public static ProfessionalService Create(Guid professionalId, Guid serviceCategoryId, string? description)
    {
        if (professionalId == Guid.Empty)
        {
            throw new DomainException("O serviço precisa de um profissional válido.");
        }

        if (serviceCategoryId == Guid.Empty)
        {
            throw new DomainException("O serviço precisa de uma categoria válida.");
        }

        var trimmedDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        if (trimmedDescription is { Length: > 500 })
        {
            throw new DomainException("A descrição do serviço não pode ter mais de 500 caracteres.");
        }

        return new ProfessionalService(Guid.NewGuid(), professionalId, serviceCategoryId, trimmedDescription);
    }

    /// <summary>Remove o serviço do perfil (desativação lógica, não exclusão — React Native: "selecionar serviços" também cobre remover).</summary>
    public void Deactivate() => Active = false;

    public void Activate() => Active = true;
}
