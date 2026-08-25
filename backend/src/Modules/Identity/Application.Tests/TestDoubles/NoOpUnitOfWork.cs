using Alilu.Modules.Identity.Application;

namespace Alilu.Modules.Identity.Application.Tests.TestDoubles;

/// <summary>
/// Nos fakes em memória, "salvar" não tem efeito nenhum — os repositórios
/// já persistem (na memória) assim que <c>AddAsync</c> é chamado, e a
/// mutação de entidades já rastreadas (ex.: <c>RefreshToken.Revoke()</c>)
/// é visível de imediato por referência.
/// </summary>
public sealed class NoOpUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
}
