using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalCategoryRepository"/> (Etapa 22).</summary>
public sealed class InMemoryProfessionalCategoryRepository : IProfessionalCategoryRepository
{
    private readonly Dictionary<Guid, ProfessionalCategory> _categories = new();

    /// <summary>Atalho de teste — mesmo espírito de <c>InMemoryServiceCategoryRepository.Seed</c>.</summary>
    public ProfessionalCategory Seed(string name, bool active = true, int displayOrder = 0)
    {
        var category = ProfessionalCategory.Create(name, description: null, displayOrder);
        if (!active)
        {
            category.Deactivate();
        }

        _categories[category.Id] = category;
        return category;
    }

    public Task<ProfessionalCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_categories.GetValueOrDefault(id));

    public Task<IReadOnlyList<ProfessionalCategory>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalCategory>>(_categories.Values.OrderBy(c => c.DisplayOrder).ToList());

    public Task<IReadOnlyList<ProfessionalCategory>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalCategory>>(_categories.Values.Where(c => c.Active).OrderBy(c => c.DisplayOrder).ToList());
}
