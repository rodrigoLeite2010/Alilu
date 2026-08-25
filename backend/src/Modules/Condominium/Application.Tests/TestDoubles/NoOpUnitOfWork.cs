using Alilu.Modules.Condominium.Application;

namespace Alilu.Modules.Condominium.Application.Tests.TestDoubles;

/// <summary>
/// Os fakes em memória já persistem no momento do <c>AddAsync</c> (não há
/// change tracking a confirmar), então esta implementação não faz nada —
/// existe só para satisfazer a assinatura de <see cref="CondominiumService"/>,
/// mesmo padrão de NoOpUnitOfWork no módulo Identity.
/// </summary>
public sealed class NoOpUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
