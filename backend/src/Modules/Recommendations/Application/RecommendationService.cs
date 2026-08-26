using Alilu.Modules.Recommendations.Domain;

namespace Alilu.Modules.Recommendations.Application;

/// <summary>Implementação de <see cref="IRecommendationService"/> — ver comentário de design/segurança lá.</summary>
public sealed class RecommendationService(
    IRecommendationRepository recommendationRepository,
    IUnitOfWork unitOfWork) : IRecommendationService
{
    /// <summary>
    /// "Não permitir spam ilimitado": um único mecanismo simples — um teto
    /// de recomendações simultâneas ainda Pending por morador. Decisão de
    /// escopo (ver ARCHITECTURE.md, "Etapa 10"): nenhuma outra checagem
    /// (ex.: duplicidade de alvo) foi pedida pelo prompt.
    /// </summary>
    public const int MaxPendingRecommendationsPerResident = 5;

    public async Task<RecommendationResponse> RecommendAsync(
        Guid condominiumId,
        Guid recommendedByUserId,
        Guid? professionalId,
        string? externalProfessionalName,
        string? externalPhone,
        Guid serviceCategoryId,
        string comment,
        CancellationToken cancellationToken = default)
    {
        var pendingCount = await recommendationRepository.CountPendingByRecommendedByUserIdAsync(recommendedByUserId, cancellationToken);
        if (pendingCount >= MaxPendingRecommendationsPerResident)
        {
            throw new TooManyPendingRecommendationsException();
        }

        var recommendation = Recommendation.Recommend(
            condominiumId,
            recommendedByUserId,
            professionalId,
            externalProfessionalName,
            externalPhone,
            serviceCategoryId,
            comment);

        await recommendationRepository.AddAsync(recommendation, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return RecommendationMapper.ToResponse(recommendation);
    }

    public async Task<IReadOnlyList<RecommendationResponse>> ListMyRecommendationsAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default)
    {
        var recommendations = await recommendationRepository.ListByRecommendedByUserIdAsync(recommendedByUserId, cancellationToken);
        return recommendations.Select(RecommendationMapper.ToResponse).ToList();
    }

    public async Task<RecommendationResponse> GetMyRecommendationAsync(Guid recommendedByUserId, Guid recommendationId, CancellationToken cancellationToken = default)
    {
        var recommendation = await recommendationRepository.GetByIdAsync(recommendationId, cancellationToken)
            ?? throw new RecommendationNotFoundException();

        // Segunda camada de defesa: uma recomendação só pode ser vista pelo
        // próprio morador que a criou — mesmo padrão de
        // ReviewService.GetOwnReviewOrThrowAsync.
        if (recommendation.RecommendedByUserId != recommendedByUserId)
        {
            throw new RecommendationNotFoundException();
        }

        return RecommendationMapper.ToResponse(recommendation);
    }
}
