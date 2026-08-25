using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Condominium.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="ICondominiumUnitRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class CondominiumUnitRepository(AliluDbContext dbContext) : ICondominiumUnitRepository
{
    public Task<CondominiumUnit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumUnit>()
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    public async Task<IReadOnlyList<CondominiumUnit>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumUnit>()
            .Where(u => u.CondominiumId == condominiumId)
            .OrderBy(u => u.Code)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsByCondominiumIdAndCodeAsync(Guid condominiumId, string code, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumUnit>()
            .AnyAsync(u => u.CondominiumId == condominiumId && u.Code == code, cancellationToken);

    public async Task AddAsync(CondominiumUnit unit, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumUnit>().AddAsync(unit, cancellationToken);
}
