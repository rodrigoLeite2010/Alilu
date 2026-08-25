using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalRepository"/>. O filtro por categoria delega para <see cref="InMemoryProfessionalServiceRepository"/>, como a implementação real faz via join.</summary>
public sealed class InMemoryProfessionalRepository(InMemoryProfessionalServiceRepository serviceRepository) : IProfessionalRepository
{
    private readonly Dictionary<Guid, Domain.Professional> _professionals = new();

    public IReadOnlyCollection<Domain.Professional> Professionals => _professionals.Values.ToList();

    public Task<Domain.Professional?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_professionals.GetValueOrDefault(id));

    public Task<Domain.Professional?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_professionals.Values.FirstOrDefault(p => p.UserId == userId));

    public Task<IReadOnlyList<Domain.Professional>> ListActiveAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default)
    {
        var query = _professionals.Values.Where(p => p.Status == ProfessionalStatus.Active);

        if (serviceCategoryId is { } categoryId)
        {
            var idsWithCategory = serviceRepository.Services
                .Where(s => s.Active && s.ServiceCategoryId == categoryId)
                .Select(s => s.ProfessionalId)
                .ToHashSet();

            query = query.Where(p => idsWithCategory.Contains(p.Id));
        }

        return Task.FromResult<IReadOnlyList<Domain.Professional>>(query.OrderBy(p => p.DisplayName).ToList());
    }

    public Task AddAsync(Domain.Professional professional, CancellationToken cancellationToken = default)
    {
        _professionals[professional.Id] = professional;
        return Task.CompletedTask;
    }
}
