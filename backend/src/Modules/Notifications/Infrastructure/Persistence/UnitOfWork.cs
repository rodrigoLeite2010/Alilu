using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Notifications.Application;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IUnitOfWork"/> — só delega ao <see cref="AliluDbContext"/> compartilhado (mesma simplicidade de <c>Alilu.Modules.Recommendations.Infrastructure.Persistence.UnitOfWork</c>).</summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
