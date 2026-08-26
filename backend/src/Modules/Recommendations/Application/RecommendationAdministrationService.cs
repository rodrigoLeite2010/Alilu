namespace Alilu.Modules.Recommendations.Application;

/// <summary>Implementação de <see cref="IRecommendationAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class RecommendationAdministrationService(
    IRecommendationRepository recommendationRepository,
    IUnitOfWork unitOfWork) : IRecommendationAdministrationService
{
    public async Task<IReadOnlyList<RecommendationResponse>> ListPendingAsync(
        RecommendationRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await recommendationRepository.ListPendingAsync(scopeCondominiumId, cancellationToken);
        return pending.Select(RecommendationMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<RecommendationResponse>> ListByCondominiumAsync(
        RecommendationRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);
        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var recommendations = await recommendationRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return recommendations.Select(RecommendationMapper.ToResponse).ToList();
    }

    public async Task<RecommendationResponse> ApproveAsync(
        RecommendationRequesterRole requesterRole,
        Guid adminUserId,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, recommendation.CondominiumId);

        if (!recommendation.IsPending)
        {
            throw new RecommendationNotPendingException();
        }

        recommendation.Approve(adminUserId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return RecommendationMapper.ToResponse(recommendation);
    }

    public async Task<RecommendationResponse> RejectAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, recommendation.CondominiumId);

        if (!recommendation.IsPending)
        {
            throw new RecommendationNotPendingException();
        }

        recommendation.Reject();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return RecommendationMapper.ToResponse(recommendation);
    }

    public async Task<RecommendationResponse> BlockAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, recommendation.CondominiumId);

        if (!recommendation.IsApproved)
        {
            throw new RecommendationNotApprovedException();
        }

        recommendation.Block();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return RecommendationMapper.ToResponse(recommendation);
    }

    private static void EnsureIsAdmin(RecommendationRequesterRole requesterRole)
    {
        if (requesterRole is not (RecommendationRequesterRole.CondominiumAdmin or RecommendationRequesterRole.SuperAdmin))
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
