using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Resident.Application;
using Alilu.Modules.Resident.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Resident.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IMembershipRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class MembershipRepository(AliluDbContext dbContext) : IMembershipRepository
{
    public Task<CondominiumMembership?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumMembership>()
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

    public async Task<IReadOnlyList<CondominiumMembership>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumMembership>()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsActiveOrPendingAsync(Guid userId, Guid condominiumId, Guid unitId, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumMembership>()
            .AnyAsync(
                m => m.UserId == userId
                    && m.CondominiumId == condominiumId
                    && m.UnitId == unitId
                    && (m.Status == MembershipStatus.Pending || m.Status == MembershipStatus.Active),
                cancellationToken);

    public async Task<IReadOnlyList<CondominiumMembership>> ListPendingAsync(Guid? condominiumId = null, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumMembership>()
            .Where(m => m.Status == MembershipStatus.Pending && (condominiumId == null || m.CondominiumId == condominiumId))
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<CondominiumMembership>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumMembership>()
            .Where(m => m.CondominiumId == condominiumId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<CondominiumMembership?> GetActiveByUnitIdAsync(Guid unitId, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumMembership>()
            .FirstOrDefaultAsync(m => m.UnitId == unitId && m.Status == MembershipStatus.Active, cancellationToken);

    public async Task AddAsync(CondominiumMembership membership, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumMembership>().AddAsync(membership, cancellationToken);
}
