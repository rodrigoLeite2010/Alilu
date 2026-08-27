using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IServiceCategoryRepository"/>.</summary>
public sealed class InMemoryServiceCategoryRepository : IServiceCategoryRepository
{
    private readonly Dictionary<Guid, ServiceCategory> _categories = new();

    /// <summary>Etapa 23 — exposto pra InMemoryProfessionalRepository resolver o filtro por categoria-pai (mesmo padrão de InMemoryProfessionalServiceRepository.Services).</summary>
    public IReadOnlyCollection<ServiceCategory> Categories => _categories.Values.ToList();

    /// <summary>
    /// Atalho de teste — mesmo espírito de seed direto usado nas fixtures do
    /// módulo Condominium. <paramref name="categoryId"/> (Etapa 22) é
    /// opcional: nenhum teste existente precisa agrupar por categoria-pai,
    /// então um Guid novo cobre a obrigatoriedade do campo sem exigir que
    /// todo teste já existente passe um valor.
    /// </summary>
    public ServiceCategory Seed(string name, bool active = true, Guid? categoryId = null)
    {
        var category = ServiceCategory.Create(name, description: null, categoryId ?? Guid.NewGuid());
        if (!active)
        {
            category.Deactivate();
        }

        _categories[category.Id] = category;
        return category;
    }

    public Task<ServiceCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_categories.GetValueOrDefault(id));

    public Task<IReadOnlyList<ServiceCategory>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ServiceCategory>>(_categories.Values.OrderBy(c => c.Name).ToList());

    public Task<IReadOnlyList<ServiceCategory>> ListActiveAsync(Guid? categoryId = null, CancellationToken cancellationToken = default)
    {
        var query = _categories.Values.Where(c => c.Active);
        if (categoryId.HasValue)
        {
            query = query.Where(c => c.CategoryId == categoryId.Value);
        }

        return Task.FromResult<IReadOnlyList<ServiceCategory>>(query.OrderBy(c => c.Name).ToList());
    }
}
