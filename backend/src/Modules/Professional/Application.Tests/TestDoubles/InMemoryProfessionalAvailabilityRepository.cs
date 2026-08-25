using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalAvailabilityRepository"/>.</summary>
public sealed class InMemoryProfessionalAvailabilityRepository : IProfessionalAvailabilityRepository
{
    private readonly Dictionary<Guid, ProfessionalAvailability> _slots = new();

    public Task<ProfessionalAvailability?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_slots.GetValueOrDefault(id));

    public Task<IReadOnlyList<ProfessionalAvailability>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalAvailability>>(
            _slots.Values.Where(a => a.ProfessionalId == professionalId).ToList());

    public Task AddAsync(ProfessionalAvailability availability, CancellationToken cancellationToken = default)
    {
        _slots[availability.Id] = availability;
        return Task.CompletedTask;
    }
}
