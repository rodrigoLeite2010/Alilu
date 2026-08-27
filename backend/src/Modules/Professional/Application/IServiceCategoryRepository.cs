using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ServiceCategory"/>.</summary>
public interface IServiceCategoryRepository
{
    Task<ServiceCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Todas as categorias (usado, por exemplo, para validar Ids sem filtrar por atividade).</summary>
    Task<IReadOnlyList<ServiceCategory>> ListAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Só especialidades <see cref="ServiceCategory.Active"/> — usado pelo
    /// diretório público (ServiceCategoryScreen) e para resolver o
    /// Categories de <see cref="ProfessionalDirectoryItemResponse"/>.
    /// <paramref name="categoryId"/> (Etapa 22) filtra pela categoria-pai —
    /// nulo devolve todas (compatibilidade com quem ainda não escolheu uma
    /// categoria, ex.: "Ver todos" em ServiceCategoryScreen).
    /// </summary>
    Task<IReadOnlyList<ServiceCategory>> ListActiveAsync(Guid? categoryId = null, CancellationToken cancellationToken = default);
}
