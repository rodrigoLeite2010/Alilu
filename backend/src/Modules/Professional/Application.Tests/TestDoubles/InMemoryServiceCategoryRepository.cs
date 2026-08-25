using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IServiceCategoryRepository"/>.</summary>
public sealed class InMemoryServiceCategoryRepository : IServiceCategoryRepository
{
    private readonly Dictionary<Guid, ServiceCategory> _categories = new();

    /// <summary>Atalho de teste — mesmo espírito de seed direto usado nas fixtures do módulo Condominium.</summary>
    public ServiceCategory Seed(string name, bool active = true)
    {
        var category = ServiceCategory.Create(name, description: null);
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

    public Task<IReadOnlyList<ServiceCategory>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ServiceCategory>>(_categories.Values.Where(c => c.Active).OrderBy(c => c.Name).ToList());
}
