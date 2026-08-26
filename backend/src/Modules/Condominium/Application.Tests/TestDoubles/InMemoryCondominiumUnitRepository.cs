using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application.Tests.TestDoubles;

public sealed class InMemoryCondominiumUnitRepository : ICondominiumUnitRepository
{
    private readonly Dictionary<Guid, CondominiumUnit> _units = new();

    public IReadOnlyCollection<CondominiumUnit> Units => _units.Values.ToList();

    public Task<CondominiumUnit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_units.GetValueOrDefault(id));

    public Task<IReadOnlyList<CondominiumUnit>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<CondominiumUnit>>(
            _units.Values.Where(u => u.CondominiumId == condominiumId).OrderBy(u => u.Code).ToList());

    public Task<bool> ExistsByCondominiumIdAndCodeAsync(Guid condominiumId, string code, Guid? excludingUnitId = null, CancellationToken cancellationToken = default) =>
        Task.FromResult(_units.Values.Any(u => u.CondominiumId == condominiumId && u.Code == code && u.Id != excludingUnitId));

    public Task AddAsync(CondominiumUnit unit, CancellationToken cancellationToken = default)
    {
        _units[unit.Id] = unit;
        return Task.CompletedTask;
    }
}
