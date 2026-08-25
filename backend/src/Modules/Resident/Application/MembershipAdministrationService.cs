namespace Alilu.Modules.Resident.Application;

/// <summary>Implementação de <see cref="IMembershipAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class MembershipAdministrationService(
    IMembershipRepository membershipRepository,
    IUnitOfWork unitOfWork) : IMembershipAdministrationService
{
    public async Task<IReadOnlyList<MembershipResponse>> ListPendingAsync(
        ResidentRequesterRole requesterRole,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await membershipRepository.ListPendingAsync(cancellationToken);
        return pending.Select(MembershipMapper.ToResponse).ToList();
    }

    public async Task<MembershipResponse> ApproveAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        if (!membership.IsPending)
        {
            throw new MembershipNotPendingException();
        }

        membership.Approve(adminUserId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MembershipMapper.ToResponse(membership);
    }

    public async Task<MembershipResponse> RejectAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        if (!membership.IsPending)
        {
            throw new MembershipNotPendingException();
        }

        membership.Reject(adminUserId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MembershipMapper.ToResponse(membership);
    }

    public async Task<MembershipResponse> BlockAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        if (!membership.IsActive)
        {
            throw new MembershipNotActiveException();
        }

        membership.Block(adminUserId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MembershipMapper.ToResponse(membership);
    }

    private static void EnsureIsAdmin(ResidentRequesterRole requesterRole)
    {
        if (requesterRole is not (ResidentRequesterRole.CondominiumAdmin or ResidentRequesterRole.SuperAdmin))
        {
            throw new InsufficientPermissionsException();
        }
    }
}
