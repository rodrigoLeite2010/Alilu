using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalServiceRepository"/>.</summary>
public sealed class InMemoryProfessionalServiceRepository : IProfessionalServiceRepository
{
    private readonly Dictionary<Guid, ProfessionalService> _services = new();

    public IReadOnlyCollection<ProfessionalService> Services => _services.Values.ToList();

    public Task<ProfessionalService?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_services.GetValueOrDefault(id));

    public Task<IReadOnlyList<ProfessionalService>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalService>>(
            _services.Values.Where(s => s.ProfessionalId == professionalId).ToList());

    public Task<IReadOnlyList<ProfessionalService>> ListActiveByProfessionalIdsAsync(IReadOnlyCollection<Guid> professionalIds, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalService>>(
            _services.Values.Where(s => s.Active && professionalIds.Contains(s.ProfessionalId)).ToList());

    public Task<bool> ExistsActiveAsync(Guid professionalId, Guid serviceCategoryId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_services.Values.Any(s => s.ProfessionalId == professionalId && s.ServiceCategoryId == serviceCategoryId && s.Active));

    public Task AddAsync(ProfessionalService professionalService, CancellationToken cancellationToken = default)
    {
        _services[professionalService.Id] = professionalService;
        return Task.CompletedTask;
    }
}
