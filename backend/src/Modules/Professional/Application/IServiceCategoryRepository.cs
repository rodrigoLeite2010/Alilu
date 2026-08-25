using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ServiceCategory"/>.</summary>
public interface IServiceCategoryRepository
{
    Task<ServiceCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Todas as categorias (usado, por exemplo, para validar Ids sem filtrar por atividade).</summary>
    Task<IReadOnlyList<ServiceCategory>> ListAsync(CancellationToken cancellationToken = default);

    /// <summary>Só categorias <see cref="ServiceCategory.Active"/> — usado pelo diretório público (ServiceCategoryScreen) e para resolver o Categories de <see cref="ProfessionalDirectoryItemResponse"/>.</summary>
    Task<IReadOnlyList<ServiceCategory>> ListActiveAsync(CancellationToken cancellationToken = default);
}
