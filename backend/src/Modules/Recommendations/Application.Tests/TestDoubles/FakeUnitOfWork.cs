using Alilu.Modules.Recommendations.Application;

namespace Alilu.Modules.Recommendations.Application.Tests.TestDoubles;

/// <summary>
/// Fake em memória de <see cref="IUnitOfWork"/> — o fake já persiste no momento do <c>AddAsync</c>/mutação direta na entidade rastreada, então <see cref="SaveChangesAsync"/> não faz nada (mesmo padrão de FakeUnitOfWork nos módulos Reviews/Scheduling).
/// <see cref="ExecuteInSerializableTransactionAsync{T}"/> (CORREÇÃO Etapa 14) simplesmente executa <c>action</c> diretamente, sem nenhuma transação de verdade — mesmo papel de <c>Alilu.Modules.Scheduling.Application.Tests.TestDoubles.FakeUnitOfWork</c>: este fake prova a checagem em memória (contagem vs. teto) diante de tentativas SEQUENCIAIS; a garantia para a corrida *genuína* depende do isolamento <c>Serializable</c> do PostgreSQL de verdade, só verificável contra um banco real (este sandbox não tem acesso a um Postgres para testar isso).
/// </summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default) =>
        action(cancellationToken);
}
