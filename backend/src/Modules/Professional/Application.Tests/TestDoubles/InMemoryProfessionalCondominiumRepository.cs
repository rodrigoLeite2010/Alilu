using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IProfessionalCondominiumRepository"/>.</summary>
public sealed class InMemoryProfessionalCondominiumRepository : IProfessionalCondominiumRepository
{
    private readonly Dictionary<Guid, ProfessionalCondominium> _associations = new();

    public Task<ProfessionalCondominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_associations.GetValueOrDefault(id));

    public Task<IReadOnlyList<ProfessionalCondominium>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalCondominium>>(
            _associations.Values.Where(pc => pc.ProfessionalId == professionalId).OrderByDescending(pc => pc.CreatedAt).ToList());

    public Task<bool> ExistsActiveOrPendingAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_associations.Values.Any(
            pc => pc.ProfessionalId == professionalId
                && pc.CondominiumId == condominiumId
                && (pc.Status == ProfessionalCondominiumStatus.Pending || pc.Status == ProfessionalCondominiumStatus.Active)));

    public Task<IReadOnlyList<ProfessionalCondominium>> ListPendingAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<ProfessionalCondominium>>(
            _associations.Values.Where(pc => pc.Status == ProfessionalCondominiumStatus.Pending).OrderBy(pc => pc.CreatedAt).ToList());

    public Task AddAsync(ProfessionalCondominium professionalCondominium, CancellationToken cancellationToken = default)
    {
        _associations[professionalCondominium.Id] = professionalCondominium;
        return Task.CompletedTask;
    }
}
