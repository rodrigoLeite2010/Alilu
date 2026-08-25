using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Condominium.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="ICondominiumInvitationRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class CondominiumInvitationRepository(AliluDbContext dbContext) : ICondominiumInvitationRepository
{
    public Task<CondominiumInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<CondominiumInvitation>()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

    public async Task AddAsync(CondominiumInvitation invitation, CancellationToken cancellationToken = default) =>
        await dbContext.Set<CondominiumInvitation>().AddAsync(invitation, cancellationToken);
}
