using System.Data;
using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Scheduling.Application;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Alilu.Modules.Scheduling.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUnitOfWork"/> — ver comentário de design em
/// <see cref="Application.IUnitOfWork"/> para a motivação completa das
/// REGRAS CRÍTICAS de concorrência do PROMPT 08.
///
/// <see cref="ExecuteInSerializableTransactionAsync{T}"/> abre uma
/// transação com <see cref="IsolationLevel.Serializable"/> — o nível mais
/// forte do PostgreSQL, onde o próprio banco garante que o resultado final
/// é equivalente a alguma execução *sequencial* das transações
/// concorrentes. Quando isso não é possível (ex.: duas transações, cada
/// uma sem ver o INSERT da outra, tentando o mesmo horário do mesmo
/// profissional), o PostgreSQL recusa uma delas com o código de erro
/// SQLSTATE <c>40001</c> ("serialization_failure") — Npgsql expõe isso como
/// <see cref="PostgresException"/> com <c>SqlState == "40001"</c>. Este é o
/// único ponto do sistema que conhece esse detalhe do driver; ele traduz a
/// falha para <see cref="BookingConflictException"/> antes de propagar, para
/// a Application (e a Api) nunca precisarem depender do Npgsql diretamente.
///
/// CORREÇÃO (Etapa 14, auditoria): a falha de serialização do algoritmo SSI
/// do PostgreSQL pode ser detectada em DOIS momentos diferentes — durante um
/// comando (INSERT/UPDATE, aí sim embrulhado pelo EF Core numa
/// <see cref="DbUpdateException"/>) OU só no COMMIT em si (o caso mais comum
/// para o padrão "lê, decide em memória, insere" usado aqui — ver
/// <c>BookingService.CreateBookingAsync</c>). <see cref="System.Data.Common.DbTransaction.CommitAsync"/>
/// não passa pelo pipeline de <c>SaveChanges</c> do EF Core, então uma falha
/// ali chega como <see cref="PostgresException"/> CRUA, não embrulhada — o
/// catch original só reconhecia o primeiro caso, deixando o segundo (o mais
/// provável na prática) escapar como erro 500 genérico em vez do 409
/// (<see cref="BookingConflictException"/>) que esta REGRA CRÍTICA promete.
/// Corrigido reconhecendo os dois formatos.
/// </summary>
public sealed class UnitOfWork(AliluDbContext dbContext) : IUnitOfWork
{
    private const string PostgresSerializationFailureSqlState = "40001";

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        dbContext.SaveChangesAsync(cancellationToken);

    public async Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);

        try
        {
            var result = await action(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch (Exception exception) when (IsSerializationFailure(exception))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new BookingConflictException();
        }
        // Qualquer outra exceção (ex.: BookingConflictException da checagem
        // em memória, ou InvalidBookingItemsException) propaga como está —
        // `await using` desfaz a transação automaticamente ao sair do
        // escopo sem commit, então não precisa de um catch genérico aqui.
    }

    /// <summary>
    /// Reconhece a falha de serialização crua (lançada direto por
    /// <c>CommitAsync</c>) OU embrulhada numa <see cref="DbUpdateException"/>
    /// (lançada por um comando dentro de <c>SaveChanges</c>) — ver comentário
    /// de correção acima. O filtro `when` desta exceção específica garante
    /// que nenhuma outra exceção (incluindo outro <see cref="PostgresException"/>
    /// com um <c>SqlState</c> diferente, ex.: violação de unicidade) seja
    /// capturada por engano aqui.
    /// </summary>
    private static bool IsSerializationFailure(Exception exception) =>
        exception is PostgresException { SqlState: PostgresSerializationFailureSqlState }
            or DbUpdateException { InnerException: PostgresException { SqlState: PostgresSerializationFailureSqlState } };
}
