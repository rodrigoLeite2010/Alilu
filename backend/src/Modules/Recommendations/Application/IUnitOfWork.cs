namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Alilu.Modules.Reviews.Application.IUnitOfWork</c> e demais
/// módulos, um tipo próprio deste módulo (nenhum módulo referencia outro).
/// Não há aqui nenhuma regra de concorrência prevista pelo prompt (ao
/// contrário do módulo Scheduling) — "não permitir spam ilimitado" é
/// verificada por uma contagem simples antes de gravar (ver
/// <see cref="RecommendationService"/>), sem necessidade de transação
/// Serializable.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
