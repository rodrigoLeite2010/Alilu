using Alilu.Modules.Resident.Domain;

namespace Alilu.Modules.Resident.Application;

/// <summary>Implementação de <see cref="IMembershipService"/> — ver comentário de design/segurança lá.</summary>
public sealed class MembershipService(
    IMembershipRepository membershipRepository,
    IUnitOfWork unitOfWork) : IMembershipService
{
    public async Task<MembershipResponse?> GetMyActiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var memberships = await membershipRepository.ListByUserIdAsync(userId, cancellationToken);
        var active = memberships.FirstOrDefault(m => m.IsActive);
        return active is null ? null : MembershipMapper.ToResponse(active);
    }

    public async Task<IReadOnlyList<MembershipResponse>> ListMyMembershipsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var memberships = await membershipRepository.ListByUserIdAsync(userId, cancellationToken);
        return memberships.Select(MembershipMapper.ToResponse).ToList();
    }

    public async Task<MembershipResponse> CreateMembershipFromInvitationAsync(
        Guid userId,
        Guid condominiumId,
        Guid unitId,
        CancellationToken cancellationToken = default)
    {
        if (await membershipRepository.ExistsActiveOrPendingAsync(userId, condominiumId, unitId, cancellationToken))
        {
            throw new DuplicateMembershipException();
        }

        var membership = CondominiumMembership.CreateActiveFromInvitation(userId, condominiumId, unitId);

        await membershipRepository.AddAsync(membership, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MembershipMapper.ToResponse(membership);
    }

    public async Task<MembershipResponse> RequestResidentAccessAsync(
        Guid userId,
        Guid condominiumId,
        Guid unitId,
        CancellationToken cancellationToken = default)
    {
        if (await membershipRepository.ExistsActiveOrPendingAsync(userId, condominiumId, unitId, cancellationToken))
        {
            throw new DuplicateMembershipException();
        }

        var membership = CondominiumMembership.CreatePendingRequest(userId, condominiumId, unitId);

        await membershipRepository.AddAsync(membership, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MembershipMapper.ToResponse(membership);
    }
}
