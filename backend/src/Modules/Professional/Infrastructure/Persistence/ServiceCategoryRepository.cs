using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IServiceCategoryRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ServiceCategoryRepository(AliluDbContext dbContext) : IServiceCategoryRepository
{
    public Task<ServiceCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ServiceCategory>()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ServiceCategory>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<ServiceCategory>()
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ServiceCategory>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<ServiceCategory>()
            .Where(c => c.Active)
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);
}
