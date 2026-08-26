using System.Data;
using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Recommendations.Application;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Alilu.Modules.Recommendations.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUnitOfWork"/> — ver comentário de correção
/// (Etapa 14, auditoria) em <see cref="Application.IUnitOfWork"/> para a
/// motivação completa. <see cref="ExecuteInSerializableTransactionAsync{T}"/>
/// é uma cópia direta de <c>Alilu.Modules.Scheduling.Infrastructure.Persistence.UnitOfWork</c>
/// (mesma detecção de falha de serialização em dois formatos — crua no
/// <c>CommitAsync</c>, ou embrulhada em <see cref="DbUpdateException"/> vinda
/// de um <c>SaveChanges</c> no meio da transação), só trocando a exceção de
/// destino para <see cref="RecommendationConflictException"/>.
/// </summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    private const string PostgresSerializationFailureSqlState = "40001";

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public async Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var result = await action(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch (Exception exception) when (IsSerializationFailure(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new RecommendationConflictException();
        }
    }

    private static bool IsSerializationFailure(Exception exception) =>
        exception is PostgresException { SqlState: PostgresSerializationFailureSqlState }
            or DbUpdateException { InnerException: PostgresException { SqlState: PostgresSerializationFailureSqlState } };
}
