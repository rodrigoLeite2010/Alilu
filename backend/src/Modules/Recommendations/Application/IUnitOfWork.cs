namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Alilu.Modules.Reviews.Application.IUnitOfWork</c> e demais
/// módulos, um tipo próprio deste módulo (nenhum módulo referencia outro).
///
/// CORREÇÃO (Etapa 14, auditoria): o comentário original desta interface
/// dizia que "não permitir spam ilimitado" bastava com uma contagem simples
/// antes de gravar (ver <see cref="RecommendationService.RecommendAsync"/>)
/// e que, ao contrário do módulo Scheduling, este módulo não precisava de
/// transação Serializable — isso estava ERRADO: "contar, comparar com o
/// teto, então inserir" é exatamente o mesmo padrão "lê, decide em memória,
/// insere" que o módulo Scheduling já sabia ser vulnerável a uma corrida
/// genuína (duas requisições concorrentes, cada uma lendo a mesma contagem
/// ANTES de qualquer uma commitar) — só que aqui a corrida deixava o
/// morador ultrapassar o teto de <see cref="RecommendationService.MaxPendingRecommendationsPerResident"/>
/// em vez de duplicar um horário. Corrigido copiando o mesmo mecanismo do
/// módulo Scheduling: <see cref="ExecuteInSerializableTransactionAsync{T}"/>
/// abre uma transação <c>Serializable</c> no PostgreSQL, que detecta esse
/// tipo de conflito de leitura/escrita entre transações concorrentes e
/// aborta uma delas — a implementação (Infrastructure) traduz essa falha em
/// <see cref="RecommendationConflictException"/> (409), em vez de um erro
/// genérico 500, para o chamador poder simplesmente tentar de novo (mesmo
/// espírito de <c>BookingConflictException</c>, mas sem reaproveitar aquele
/// tipo — é um tipo próprio deste módulo, mesma razão de sempre).
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Executa <paramref name="action"/> dentro de uma transação
    /// <c>Serializable</c>, comita ao final e devolve o resultado. Se o
    /// banco detectar uma condição de corrida ao comitar, a implementação
    /// desfaz a transação e lança <see cref="RecommendationConflictException"/>
    /// em vez de propagar o erro específico do driver — mesmo contrato de
    /// <c>Alilu.Modules.Scheduling.Application.IUnitOfWork.ExecuteInSerializableTransactionAsync</c>.
    /// </summary>
    Task<T> ExecuteInSerializableTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken = default);
}
