namespace Alilu.Modules.Resident.Application;

/// <summary>Implementação de <see cref="IMembershipAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class MembershipAdministrationService(
    IMembershipRepository membershipRepository,
    IUnitOfWork unitOfWork) : IMembershipAdministrationService
{
    public async Task<IReadOnlyList<MembershipResponse>> ListPendingAsync(
        ResidentRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await membershipRepository.ListPendingAsync(scopeCondominiumId, cancellationToken);
        return pending.Select(MembershipMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<MembershipResponse>> ListByCondominiumAsync(
        ResidentRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);
        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var memberships = await membershipRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return memberships.Select(MembershipMapper.ToResponse).ToList();
    }

    public async Task<MembershipResponse> GetByIdAsync(
        ResidentRequesterRole requesterRole,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, membership.CondominiumId);

        return MembershipMapper.ToResponse(membership);
    }

    public async Task<MembershipResponse?> GetActiveByUnitAsync(
        ResidentRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetActiveByUnitIdAsync(unitId, cancellationToken);
        if (membership is null)
        {
            return null;
        }

        EnsureScopeMatches(scopeCondominiumId, membership.CondominiumId);

        return MembershipMapper.ToResponse(membership);
    }

    public async Task<MembershipResponse> ApproveAsync(
        ResidentRequesterRole requesterRole,
        Guid adminUserId,
        Guid membershipId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, membership.CondominiumId);

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
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, membership.CondominiumId);

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
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var membership = await membershipRepository.GetByIdAsync(membershipId, cancellationToken)
            ?? throw new MembershipNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, membership.CondominiumId);

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

    /// <summary>
    /// "CondominiumAdmin somente pode administrar seu próprio condomínio"
    /// (PROMPT 12) — <paramref name="scopeCondominiumId"/> nulo (SuperAdmin)
    /// sempre passa; não-nulo só passa se igual a
    /// <paramref name="targetCondominiumId"/>. Resolvido pela Api via
    /// <c>Administration.IAdminScopeService</c> antes de chamar este módulo.
    /// </summary>
    private static void EnsureScopeMatches(Guid? scopeCondominiumId, Guid targetCondominiumId)
    {
        if (scopeCondominiumId is not null && scopeCondominiumId.Value != targetCondominiumId)
        {
            throw new InsufficientPermissionsException();
        }
    }
}
