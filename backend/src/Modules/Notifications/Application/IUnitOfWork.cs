namespace Alilu.Modules.Notifications.Application;

/// <summary>Mesma simplicidade de <c>Alilu.Modules.Recommendations.Application.IUnitOfWork</c> — este módulo também não precisa de transação Serializable.</summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
