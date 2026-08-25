using Alilu.Modules.Professional.Application;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>
/// Os fakes em memória já persistem no momento do <c>AddAsync</c>/mutação
/// direta na entidade rastreada (não há change tracking a confirmar),
/// então esta implementação não faz nada — mesmo padrão de NoOpUnitOfWork
/// no módulo Resident.
/// </summary>
public sealed class NoOpUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
