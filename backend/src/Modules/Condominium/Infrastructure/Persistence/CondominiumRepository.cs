using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Condominium.Application;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="ICondominiumRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class CondominiumRepository(AliluDbContext dbContext) : ICondominiumRepository
{
    public Task<Domain.Condominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Condominium>()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Domain.Condominium>> ListAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<Domain.Condominium>()
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsByCnpjAsync(string normalizedCnpj, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Condominium>()
            .AnyAsync(c => c.Cnpj.Value == normalizedCnpj, cancellationToken);

    public async Task AddAsync(Domain.Condominium condominium, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Domain.Condominium>().AddAsync(condominium, cancellationToken);
}
