using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Administration.Application;
using Alilu.Modules.Administration.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Administration.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="ICondominiumAdministratorRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class CondominiumAdministratorRepository(AliluDbContext dbContext) : ICondominiumAdministratorRepository
{
    public Task<CondominiumAdministrator?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumAdministrator>().FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);

    public async Task<IReadOnlyList<CondominiumAdministrator>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumAdministrator>()
            .OrderBy(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(CondominiumAdministrator administrator, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumAdministrator>().AddAsync(administrator, cancellationToken);
}
