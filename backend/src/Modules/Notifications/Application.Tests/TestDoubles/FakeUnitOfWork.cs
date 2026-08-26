using Alilu.Modules.Notifications.Application;

namespace Alilu.Modules.Notifications.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IUnitOfWork"/> — mesmo padrão de FakeUnitOfWork nos demais módulos.</summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
