namespace Alilu.Modules.Recommendations.Application;

/// <summary>Implementação de <see cref="IRecommendationDirectoryService"/> — ver comentário de design lá.</summary>
public sealed class RecommendationDirectoryService(IRecommendationRepository recommendationRepository) : IRecommendationDirectoryService
{
    public async Task<ProfessionalRecommendationSummaryResponse> GetSummaryByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var approved = await recommendationRepository.ListApprovedByProfessionalIdAsync(professionalId, cancellationToken);
        return new ProfessionalRecommendationSummaryResponse(professionalId, approved.Count);
    }

    public async Task<IReadOnlyList<RecommendationResponse>> ListApprovedByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var approved = await recommendationRepository.ListApprovedByProfessionalIdAsync(professionalId, cancellationToken);
        return approved.Select(RecommendationMapper.ToResponse).ToList();
    }
}
