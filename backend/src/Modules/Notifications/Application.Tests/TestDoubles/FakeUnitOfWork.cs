using Alilu.Modules.Notifications.Application;

namespace Alilu.Modules.Notifications.Application.Tests.TestDoubles;

/// <summary>
/// Fake em memória de <see cref="IUnitOfWork"/> — mesmo padrão de FakeUnitOfWork nos demais módulos.
/// <see cref="SaveChangesOrIgnoreDuplicateAsync"/> (CORREÇÃO Etapa 14) sempre devolve <c>true</c> — este fake não tem um índice único de verdade para violar; a garantia contra a corrida genuína depende do PostgreSQL real, só verificável contra um banco de verdade (este sandbox não tem acesso a um Postgres para testar isso, mesma limitação já documentada para a concorrência do módulo Scheduling).
/// </summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<bool> SaveChangesOrIgnoreDuplicateAsync(CancellationToken cancellationToken = default) => Task.FromResult(true);
}
