using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Mural.Application;

namespace Alilu.Modules.Mural.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IUnitOfWork"/> — só delega ao <see cref="AliluDbContext"/> compartilhado (mesma simplicidade de <c>Alilu.Modules.Reviews.Infrastructure.Persistence.UnitOfWork</c>; este módulo não precisa de uma transação Serializable — ver comentário em <see cref="Application.IUnitOfWork"/>).</summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
