using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Administration.Application;

namespace Alilu.Modules.Administration.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IUnitOfWork"/> — só delega ao <see cref="AliluDbContext"/> compartilhado (mesma simplicidade de <c>Alilu.Modules.Recommendations.Infrastructure.Persistence.UnitOfWork</c>; este módulo também não precisa de uma transação Serializable).</summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
