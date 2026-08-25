namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho —
/// mesmo papel de <c>Alilu.Modules.Condominium.Application.IUnitOfWork</c>,
/// um tipo próprio deste módulo (nenhum módulo referencia outro).
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
