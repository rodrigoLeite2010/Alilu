using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalCategory"/> (Etapa 22).</summary>
public interface IProfessionalCategoryRepository
{
    Task<ProfessionalCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Todas as categorias (usado pelo seeder para resolver nomes → Id sem filtrar por atividade).</summary>
    Task<IReadOnlyList<ProfessionalCategory>> ListAsync(CancellationToken cancellationToken = default);

    /// <summary>Só categorias <see cref="ProfessionalCategory.Active"/>, ordenadas por <see cref="ProfessionalCategory.DisplayOrder"/> — usado pelo diretório público (nova tela de categorias do morador).</summary>
    Task<IReadOnlyList<ProfessionalCategory>> ListActiveAsync(CancellationToken cancellationToken = default);
}
