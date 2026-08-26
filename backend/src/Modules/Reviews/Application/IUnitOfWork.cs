namespace Alilu.Modules.Reviews.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Alilu.Modules.Scheduling.Application.IUnitOfWork</c>/
/// <c>Alilu.Modules.Resident.Application.IUnitOfWork</c>, um tipo próprio
/// deste módulo (nenhum módulo referencia outro). Diferente do módulo
/// Scheduling, "somente uma Review por Booking" é garantida por um índice
/// único simples (não há corrida de concorrência prevista no prompt para
/// avaliações), então não há aqui um equivalente de
/// <c>ExecuteInSerializableTransactionAsync</c>.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
