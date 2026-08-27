using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Especialidade de serviço (Diarista, Jardineiro, Piscineiro, Eletricista,
/// Encanador, Pedreiro, Pintor — PROMPT 06, "CATEGORIAS INICIAIS"; dezenas
/// de outras a partir da Etapa 22). Lista global, compartilhada por todos
/// os condomínios — não pertence a nenhum profissional/condomínio
/// específico. O nome da classe/tabela ("ServiceCategory"/"service_categories")
/// ficou de antes da Etapa 22 e não foi renomeado (evitar uma migration
/// disruptiva por causa de um nome só) — na navegação do morador e no
/// vocabulário de Rodrigo, isto é a "Especialidade", uma folha dentro de
/// uma <see cref="ProfessionalCategory"/> ("Categoria").
///
/// As categorias/especialidades iniciais são inseridas por um seeder de
/// desenvolvimento (ver <c>ServiceCategorySeeder</c> em Infrastructure,
/// mesmo padrão do <c>CondominiumSeeder</c>) — não há endpoint de CRUD
/// nesta etapa (não pedido pelo prompt).
///
/// <see cref="CategoryId"/> (Etapa 22) segue a mesma decisão de design de
/// <see cref="ProfessionalService"/>/<see cref="ProfessionalCondominium"/>:
/// só o Id como valor simples, sem navegação EF para <see cref="ProfessionalCategory"/>
/// — mantém as duas entidades independentes/testáveis isoladamente, mesmo
/// morando no mesmo módulo (ver ARCHITECTURE.md).
/// </summary>
public sealed class ServiceCategory : AggregateRoot
{
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public Guid CategoryId { get; private set; }
    public bool Active { get; private set; }

#pragma warning disable CS8618
    private ServiceCategory()
    {
    }
#pragma warning restore CS8618

    private ServiceCategory(Guid id, string name, string? description, Guid categoryId)
        : base(id)
    {
        Name = name;
        Description = description;
        CategoryId = categoryId;
        Active = true;
    }

    /// <summary>
    /// Cria uma especialidade. A unicidade do nome e a existência da
    /// categoria são responsabilidade da Application/seeder (ver índice
    /// único em Infrastructure) — esta entidade, isolada, não tem como
    /// validar isso.
    /// </summary>
    public static ServiceCategory Create(string name, string? description, Guid categoryId)
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

        if (categoryId == Guid.Empty)
        {
            throw new DomainException("A especialidade precisa de uma categoria válida.");
        }

        var trimmedDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();

        return new ServiceCategory(Guid.NewGuid(), trimmedName, trimmedDescription, categoryId);
    }

    /// <summary>
    /// Corrige/atribui a categoria-pai. Além de uso normal, cobre o
    /// BACKFILL das sete especialidades que existiam antes da Etapa 22 (sem
    /// <see cref="CategoryId"/>) — o seeder chama isto para todas, criadas
    /// agora ou não, em vez de exigir apagar/recriar as linhas já existentes
    /// (que quebraria qualquer <see cref="ProfessionalService"/> já
    /// vinculado a elas, pois não há FK de verdade — só o Id como valor).
    /// </summary>
    public void AssignCategory(Guid categoryId)
    {
        if (categoryId == Guid.Empty)
        {
            throw new DomainException("A especialidade precisa de uma categoria válida.");
        }

        CategoryId = categoryId;
    }

    public void Deactivate() => Active = false;

    public void Activate() => Active = true;
}
