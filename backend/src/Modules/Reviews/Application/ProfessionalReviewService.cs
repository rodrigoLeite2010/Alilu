namespace Alilu.Modules.Reviews.Application;

/// <summary>Implementação de <see cref="IProfessionalReviewService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalReviewService(IReviewRepository reviewRepository) : IProfessionalReviewService
{
    public async Task<IReadOnlyList<ReviewResponse>> ListReceivedAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var reviews = await reviewRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);
        return reviews.Select(ReviewMapper.ToResponse).ToList();
    }

    public async Task<ProfessionalRatingSummaryResponse> GetRatingSummaryAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var reviews = await reviewRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);
        if (reviews.Count == 0)
        {
            return new ProfessionalRatingSummaryResponse(professionalId, 0, 0);
        }

        var average = reviews.Average(review => review.Rating);
        return new ProfessionalRatingSummaryResponse(professionalId, reviews.Count, Math.Round(average, 2));
    }
}
