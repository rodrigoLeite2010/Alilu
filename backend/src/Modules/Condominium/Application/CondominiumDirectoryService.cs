using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Implementação de <see cref="ICondominiumDirectoryService"/> — ver comentário de design lá.</summary>
public sealed class CondominiumDirectoryService(
    ICondominiumRepository condominiumRepository,
    ICondominiumUnitRepository unitRepository) : ICondominiumDirectoryService
{
    public async Task<IReadOnlyList<CondominiumSummaryResponse>> ListActiveCondominiumsAsync(CancellationToken cancellationToken = default)
    {
        var condominiums = await condominiumRepository.ListAsync(cancellationToken);
        return condominiums.Where(c => c.IsActive).Select(ToSummary).ToList();
    }

    public async Task<IReadOnlyList<CondominiumUnitSummaryResponse>> ListActiveUnitsAsync(Guid condominiumId, CancellationToken cancellationToken = default)
    {
        _ = await condominiumRepository.GetByIdAsync(condominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        var units = await unitRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return units.Where(u => u.IsActive).Select(ToSummary).ToList();
    }

    public async Task ValidateUnitAsync(Guid condominiumId, Guid unitId, CancellationToken cancellationToken = default)
    {
        var condominium = await condominiumRepository.GetByIdAsync(condominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        var unit = await unitRepository.GetByIdAsync(unitId, cancellationToken)
            ?? throw new CondominiumUnitNotFoundException();

        if (unit.CondominiumId != condominium.Id)
        {
            throw new UnitDoesNotBelongToCondominiumException();
        }
    }

    public async Task ValidateCondominiumAsync(Guid condominiumId, CancellationToken cancellationToken = default)
    {
        _ = await condominiumRepository.GetByIdAsync(condominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();
    }

    private static CondominiumSummaryResponse ToSummary(Domain.Condominium condominium) =>
        new(condominium.Id, condominium.Name, condominium.City, condominium.State);

    private static CondominiumUnitSummaryResponse ToSummary(CondominiumUnit unit) =>
        new(unit.Id, unit.Code, unit.Type);
}
