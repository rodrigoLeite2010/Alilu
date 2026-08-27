namespace Alilu.Modules.Mural.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Alilu.Modules.Reviews.Application.IUnitOfWork</c>, um tipo
/// próprio deste módulo (nenhum módulo referencia outro). Diferente do
/// módulo Recommendations (Etapa 14, auditoria), não há aqui nenhuma regra
/// de "limite/spam" com risco de corrida entre requisições concorrentes —
/// por isso não há um equivalente de <c>ExecuteInSerializableTransactionAsync</c>,
/// mesma simplicidade do módulo Reviews.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
