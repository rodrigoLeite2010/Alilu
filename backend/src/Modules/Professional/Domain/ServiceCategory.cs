using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Categoria de serviço (Diarista, Jardineiro, Piscineiro, Eletricista,
/// Encanador, Pedreiro, Pintor — PROMPT 06, "CATEGORIAS INICIAIS"). Lista
/// global, compartilhada por todos os condomínios — não pertence a nenhum
/// profissional/condomínio específico.
///
/// As sete categorias iniciais são inseridas por um seeder de
/// desenvolvimento (ver <c>ServiceCategorySeeder</c> em Infrastructure,
/// mesmo padrão do <c>CondominiumSeeder</c>) — não há endpoint de CRUD de
/// categoria nesta etapa (não pedido pelo prompt).
/// </summary>
public sealed class ServiceCategory : AggregateRoot
{
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public bool Active { get; private set; }

#pragma warning disable CS8618
    private ServiceCategory()
    {
    }
#pragma warning restore CS8618

    private ServiceCategory(Guid id, string name, string? description)
        : base(id)
    {
        Name = name;
        Description = description;
        Active = true;
    }

    /// <summary>
    /// Cria uma categoria. A unicidade do nome é responsabilidade da
    /// Application/seeder (ver índice único em Infrastructure) — esta
    /// entidade, isolada, não tem como saber sobre as demais categorias.
    /// </summary>
    public static ServiceCategory Create(string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("O nome da categoria não pode ser vazio.");
        }

        var trimmedName = name.Trim();
        if (trimmedName.Length > 80)
        {
            throw new DomainException("O nome da categoria não pode ter mais de 80 caracteres.");
        }

        var trimmedDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        return new ServiceCategory(Guid.NewGuid(), trimmedName, trimmedDescription);
    }

    public void Deactivate() => Active = false;

    public void Activate() => Active = true;
}
