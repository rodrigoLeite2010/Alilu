namespace Alilu.Modules.Recommendations.Application;

/// <summary>Implementação de <see cref="IRecommendationAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class RecommendationAdministrationService(
    IRecommendationRepository recommendationRepository,
    IUnitOfWork unitOfWork) : IRecommendationAdministrationService
{
    public async Task<IReadOnlyList<RecommendationResponse>> ListPendingAsync(
        RecommendationRequesterRole requesterRole,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await recommendationRepository.ListPendingAsync(cancellationToken);
        return pending.Select(RecommendationMapper.ToResponse).ToList();
    }

    public async Task<RecommendationResponse> ApproveAsync(
        RecommendationRequesterRole requesterRole,
        Guid adminUserId,
        Guid recommendationId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

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
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

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
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

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
}
