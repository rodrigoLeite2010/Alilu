using Alilu.Modules.Recommendations.Application;

namespace Alilu.Modules.Recommendations.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IUnitOfWork"/> — o fake já persiste no momento do <c>AddAsync</c>/mutação direta na entidade rastreada, então <see cref="SaveChangesAsync"/> não faz nada (mesmo padrão de FakeUnitOfWork nos módulos Reviews/Scheduling).</summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
