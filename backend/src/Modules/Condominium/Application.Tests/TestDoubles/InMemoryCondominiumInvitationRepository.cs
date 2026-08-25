using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application.Tests.TestDoubles;

public sealed class InMemoryCondominiumInvitationRepository : ICondominiumInvitationRepository
{
    private readonly Dictionary<Guid, CondominiumInvitation> _invitations = new();

    public IReadOnlyCollection<CondominiumInvitation> Invitations => _invitations.Values.ToList();

    public Task<CondominiumInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_invitations.GetValueOrDefault(id));

    public Task<CondominiumInvitation?> GetByCodeHashAsync(string codeHash, CancellationToken cancellationToken = default) =>
        Task.FromResult(_invitations.Values.FirstOrDefault(i => i.CodeHash == codeHash));

    public Task AddAsync(CondominiumInvitation invitation, CancellationToken cancellationToken = default)
    {
        _invitations[invitation.Id] = invitation;
        return Task.CompletedTask;
    }
}
