using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalAvailabilityExceptionRepository"/>.</summary>
public sealed class InMemoryProfessionalAvailabilityExceptionRepository : IProfessionalAvailabilityExceptionRepository
{
    private readonly Dictionary<Guid, ProfessionalAvailabilityException> _exceptions = new();

    public Task<ProfessionalAvailabilityException?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_exceptions.GetValueOrDefault(id));

    public Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalAvailabilityException>>(
            _exceptions.Values.Where(e => e.ProfessionalId == professionalId).ToList());

    public Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAndDateAsync(Guid professionalId, DateOnly date, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalAvailabilityException>>(
            _exceptions.Values.Where(e => e.ProfessionalId == professionalId && e.Date == date).ToList());

    public Task AddAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default)
    {
        _exceptions[exception.Id] = exception;
        return Task.CompletedTask;
    }

    public Task RemoveAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default)
    {
        _exceptions.Remove(exception.Id);
        return Task.CompletedTask;
    }
}
