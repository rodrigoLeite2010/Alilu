using Alilu.Modules.Resident.Application;
using Alilu.Modules.Resident.Domain;

namespace Alilu.Modules.Resident.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IMembershipRepository"/>, mesmo espírito de InMemoryCondominiumRepository no módulo Condominium.</summary>
public sealed class InMemoryMembershipRepository : IMembershipRepository
{
    private readonly Dictionary<Guid, CondominiumMembership> _memberships = new();

    public IReadOnlyCollection<CondominiumMembership> Memberships => _memberships.Values.ToList();

    public Task<CondominiumMembership?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_memberships.GetValueOrDefault(id));

    public Task<IReadOnlyList<CondominiumMembership>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<CondominiumMembership>>(
            _memberships.Values.Where(m => m.UserId == userId).OrderByDescending(m => m.CreatedAt).ToList());

    public Task<bool> ExistsActiveOrPendingAsync(Guid userId, Guid condominiumId, Guid unitId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_memberships.Values.Any(
            m => m.UserId == userId
                && m.CondominiumId == condominiumId
                && m.UnitId == unitId
                && (m.Status == MembershipStatus.Pending || m.Status == MembershipStatus.Active)));

    public Task<IReadOnlyList<CondominiumMembership>> ListPendingAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<CondominiumMembership>>(
            _memberships.Values.Where(m => m.Status == MembershipStatus.Pending).OrderBy(m => m.CreatedAt).ToList());

    public Task AddAsync(CondominiumMembership membership, CancellationToken cancellationToken = default)
    {
        _memberships[membership.Id] = membership;
        return Task.CompletedTask;
    }
}
