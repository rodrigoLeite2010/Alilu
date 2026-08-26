using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Notifications.Application;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUnitOfWork"/> — ver comentário de correção
/// (Etapa 14, auditoria) em <see cref="Application.IUnitOfWork"/> para a
/// motivação completa de <see cref="SaveChangesOrIgnoreDuplicateAsync"/>.
/// </summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    private const string PostgresUniqueViolationSqlState = "23505";

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public async Task<bool> SaveChangesOrIgnoreDuplicateAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception exception) when (IsDuplicateNotification(exception))
        {
            return false;
        }
    }

    /// <summary>
    /// Reconhece a violação do índice único (UserId, Type, ReferenceId) —
    /// ver <c>NotificationConfiguration</c> — crua (<see cref="PostgresException"/>)
    /// ou embrulhada numa <see cref="DbUpdateException"/> pelo EF Core,
    /// mesmo padrão de detecção em dois formatos usado por
    /// <c>Alilu.Modules.Scheduling.Infrastructure.Persistence.UnitOfWork</c>
    /// (lá para falha de serialização "40001"; aqui para violação de
    /// unicidade "23505" — o único índice único desta tabela é exatamente
    /// o que protege a REGRA "não enviar notificações duplicadas", então
    /// não há risco de engolir por engano uma violação de outra restrição).
    /// </summary>
    private static bool IsDuplicateNotification(Exception exception) =>
        exception is PostgresException { SqlState: PostgresUniqueViolationSqlState }
            or DbUpdateException { InnerException: PostgresException { SqlState: PostgresUniqueViolationSqlState } };
}
