using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Porta de persistência de <see cref="CondominiumUnit"/>.</summary>
public interface ICondominiumUnitRepository
{
    Task<CondominiumUnit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CondominiumUnit>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    Task<bool> ExistsByCondominiumIdAndCodeAsync(Guid condominiumId, string code, CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumUnit unit, CancellationToken cancellationToken = default);
}
