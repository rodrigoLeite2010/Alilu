namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho —
/// mesmo papel de <c>Alilu.Modules.Identity.Application.IUnitOfWork</c>,
/// um tipo próprio deste módulo (nenhum módulo referencia outro).
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
