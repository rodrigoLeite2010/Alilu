using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalCategoryRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalCategoryRepository(AliluDbContext dbContext) : IProfessionalCategoryRepository
{
    public Task<ProfessionalCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalCategory>()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalCategory>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCategory>()
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ProfessionalCategory>> ListActiveAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCategory>()
            .Where(c => c.Active)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync(cancellationToken);
}
