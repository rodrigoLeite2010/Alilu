namespace Alilu.Modules.Administration.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho — mesmo
/// papel de <c>Recommendations.Application.IUnitOfWork</c> e demais módulos,
/// um tipo próprio deste módulo (nenhum módulo referencia outro).
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
