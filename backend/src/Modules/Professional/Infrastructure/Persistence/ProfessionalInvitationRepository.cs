using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalInvitationRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalInvitationRepository(AliluDbContext dbContext) : IProfessionalInvitationRepository
{
    public Task<int> CountByInvitedByUserIdSinceAsync(Guid invitedByUserId, DateTime sinceUtc, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalInvitation>()
            .CountAsync(i => i.InvitedByUserId == invitedByUserId && i.CreatedAt >= sinceUtc, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalInvitation>> ListByInvitedByUserIdAsync(Guid invitedByUserId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalInvitation>()
            .Where(i => i.InvitedByUserId == invitedByUserId)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ProfessionalInvitation invitation, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalInvitation>().AddAsync(invitation, cancellationToken);
}
