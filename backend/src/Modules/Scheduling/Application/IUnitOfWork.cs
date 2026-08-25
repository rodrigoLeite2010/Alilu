namespace Alilu.Modules.Scheduling.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Alilu.Modules.Resident.Application.IUnitOfWork</c>, um tipo
/// próprio deste módulo (nenhum módulo referencia outro).
///
/// "Deve usar transação e mecanismo de concorrência adequado" / "verificação
/// de conflito deve acontecer no servidor" (REGRAS CRÍTICAS do PROMPT 08) —
/// <see cref="ExecuteInSerializableTransactionAsync{T}"/> é o único método
/// novo em relação aos demais módulos: abre uma transação de isolamento
/// <c>Serializable</c> no banco, executa <paramref name="action"/> dentro
/// dela e confirma. Isolamento <c>Serializable</c> faz o próprio PostgreSQL
/// detectar quando duas transações concorrentes leem/escrevem de um jeito
/// que produziria um resultado impossível em execução sequencial (ex.: dois
/// moradores tentando o mesmo horário do mesmo profissional ao mesmo
/// tempo) — quando isso acontece, uma das duas falha ao tentar confirmar, e
/// a implementação (Infrastructure) traduz essa falha em
/// <see cref="BookingConflictException"/>, para o chamador nunca precisar
/// conhecer o tipo de exceção específico do driver do banco (Npgsql) — ver
/// ARCHITECTURE.md, "Etapa 08 — concorrência", para o desenho completo
/// (checagem de sobreposição em memória ANTES de persistir, mais esta rede
/// de segurança no banco para a corrida genuína entre duas requisições
/// concorrentes que a checagem em memória sozinha não pega).
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Executa <paramref name="action"/> dentro de uma transação
    /// <c>Serializable</c>, comita ao final e devolve o resultado. Se o
    /// banco detectar uma condição de corrida ao comitar, a implementação
    /// desfaz a transação e lança <see cref="BookingConflictException"/> em
    /// vez de propagar o erro específico do driver.
    /// </summary>
    Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default);
}
