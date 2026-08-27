using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Categoria de profissional (Etapa 22, pedido de Rodrigo: "cadastrar mais
/// categorias em profissionais") — o nível ACIMA de <see cref="ServiceCategory"/>
/// na navegação do morador (React Native: "Categoria → Especialidade →
/// Lista de profissionais"). Ex.: "Reparos e Manutenção" agrupa as
/// especialidades Eletricista/Encanador/Pintor/Pedreiro/etc.
///
/// Assim como <see cref="ServiceCategory"/> (ver comentário lá para o
/// histórico): lista global, compartilhada por todos os condomínios, sem
/// endpoint de CRUD nesta etapa — populada por um seeder de desenvolvimento
/// (<c>ProfessionalCategorySeeder</c>).
///
/// <see cref="DisplayOrder"/> existe só para a tela do morador poder
/// mostrar as categorias na ordem sugerida por Rodrigo ("CATEGORIAS
/// PRINCIPAIS PARA O APP" — as mais comuns primeiro), sem precisar
/// hard-codar essa ordem no React Native nem depender da ordem alfabética.
/// </summary>
public sealed class ProfessionalCategory : AggregateRoot
{
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public int DisplayOrder { get; private set; }
    public bool Active { get; private set; }

#pragma warning disable CS8618
    private ProfessionalCategory()
    {
    }
#pragma warning restore CS8618

    private ProfessionalCategory(Guid id, string name, string? description, int displayOrder)
        : base(id)
    {
        Name = name;
        Description = description;
        DisplayOrder = displayOrder;
        Active = true;
    }

    /// <summary>
    /// Cria uma categoria. A unicidade do nome é responsabilidade da
    /// Application/seeder (ver índice único em Infrastructure) — esta
    /// entidade, isolada, não tem como saber sobre as demais categorias.
    /// </summary>
    public static ProfessionalCategory Create(string name, string? description, int displayOrder)
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

        return new ProfessionalCategory(Guid.NewGuid(), trimmedName, trimmedDescription, displayOrder);
    }

    /// <summary>Usado pelo seeder para corrigir a ordem de exibição sem recriar a categoria (mesmo raciocínio de <see cref="ServiceCategory.AssignCategory"/> para o backfill de <c>CategoryId</c>).</summary>
    public void SetDisplayOrder(int displayOrder) => DisplayOrder = displayOrder;

    public void Deactivate() => Active = false;

    public void Activate() => Active = true;
}
