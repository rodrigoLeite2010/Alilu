using Alilu.Modules.Scheduling.Application;

namespace Alilu.Modules.Scheduling.Application.Tests.TestDoubles;

/// <summary>
/// Fake em memória de <see cref="IUnitOfWork"/> — os fakes já persistem no
/// momento do <c>AddAsync</c>/mutação direta na entidade rastreada, então
/// <see cref="SaveChangesAsync"/> não faz nada (mesmo padrão de NoOpUnitOfWork
/// nos demais módulos). <see cref="ExecuteInSerializableTransactionAsync{T}"/>
/// simplesmente executa <c>action</c> diretamente, sem nenhuma transação de
/// verdade — este fake prova que a checagem de conflito EM MEMÓRIA
/// (<c>BookingService.CreateBookingAsync</c>) funciona corretamente diante
/// de tentativas SEQUENCIAIS pelo mesmo horário (ver
/// <c>BookingCreationTests.CreateBookingAsync_SecondAttemptForTheSameSlot_ThrowsBookingConflict</c>,
/// que cobre o teste "dois moradores tentam o mesmo horário" do PROMPT 08
/// nesse sentido sequencial). A garantia para a corrida *genuína*
/// (concorrência real de duas requisições ao mesmo tempo) depende do
/// isolamento <c>Serializable</c> do PostgreSQL de verdade — só verificável
/// rodando contra um banco real (ver
/// <c>Alilu.Modules.Scheduling.Infrastructure.Persistence.UnitOfWork</c> e
/// ARCHITECTURE.md, "Etapa 08 — concorrência" — este sandbox não tem acesso
/// a um Postgres para testar isso).
/// </summary>
public sealed class FakeUnitOfWork : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default) =>
        action(cancellationToken);
}
