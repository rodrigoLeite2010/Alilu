using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Resident.Application;

namespace Alilu.Modules.Resident.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUnitOfWork"/> que apenas delega para
/// <see cref="AliluDbContext.SaveChangesAsync(CancellationToken)"/>.
/// </summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
