using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUnitOfWork"/> que apenas delega para
/// <see cref="AliluDbContext.SaveChangesAsync(CancellationToken)"/>.
/// </summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
