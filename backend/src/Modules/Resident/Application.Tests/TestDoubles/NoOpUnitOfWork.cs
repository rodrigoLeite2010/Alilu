using Alilu.Modules.Resident.Application;

namespace Alilu.Modules.Resident.Application.Tests.TestDoubles;

/// <summary>
/// Os fakes em memória já persistem no momento do <c>AddAsync</c>/mutação
/// direta na entidade rastreada (não há change tracking a confirmar),
/// então esta implementação não faz nada — existe só para satisfazer a
/// assinatura de <see cref="MembershipService"/>/<see cref="MembershipAdministrationService"/>,
/// mesmo padrão de NoOpUnitOfWork no módulo Condominium.
/// </summary>
public sealed class NoOpUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
