using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Porta de persistência de <see cref="CondominiumInvitation"/>.</summary>
public interface ICondominiumInvitationRepository
{
    Task<CondominiumInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumInvitation invitation, CancellationToken cancellationToken = default);
}
