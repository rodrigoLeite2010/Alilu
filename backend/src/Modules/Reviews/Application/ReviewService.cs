using Alilu.Modules.Reviews.Domain;

namespace Alilu.Modules.Reviews.Application;

/// <summary>Implementação de <see cref="IReviewService"/> — ver comentário de design/segurança lá.</summary>
public sealed class ReviewService(
    IReviewRepository reviewRepository,
    IUnitOfWork unitOfWork) : IReviewService
{
    public async Task<ReviewResponse> CreateAsync(
        Guid residentId,
        Guid bookingId,
        Guid professionalId,
        int rating,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        // Checagem em memória (o caso comum) — o índice único em BookingId
        // (Infrastructure) é a rede de segurança para a corrida genuína
        // entre duas requisições concorrentes, mesmo espírito do conflito de
        // horário do módulo Scheduling, sem precisar de uma transação
        // Serializable (não há aqui uma janela de disponibilidade a
        // proteger, só uma unicidade simples).
        var existing = await reviewRepository.GetByBookingIdAsync(bookingId, cancellationToken);
        if (existing is not null)
        {
            throw new DuplicateReviewException();
        }

        var review = Review.Create(bookingId, residentId, professionalId, rating, comment);
        await reviewRepository.AddAsync(review, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ReviewMapper.ToResponse(review);
    }

    public async Task<ReviewResponse> EditAsync(
        Guid residentId,
        Guid reviewId,
        int rating,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        var review = await GetOwnReviewOrThrowAsync(residentId, reviewId, cancellationToken);

        review.Edit(rating, comment);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ReviewMapper.ToResponse(review);
    }

    public async Task<IReadOnlyList<ReviewResponse>> ListMyReviewsAsync(Guid residentId, CancellationToken cancellationToken = default)
    {
        var reviews = await reviewRepository.ListByResidentIdAsync(residentId, cancellationToken);
        return reviews.Select(ReviewMapper.ToResponse).ToList();
    }

    public async Task<ReviewResponse?> GetMyReviewForBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var review = await reviewRepository.GetByBookingIdAsync(bookingId, cancellationToken);
        if (review is null || review.ResidentId != residentId)
        {
            return null;
        }

        return ReviewMapper.ToResponse(review);
    }

    private async Task<Review> GetOwnReviewOrThrowAsync(Guid residentId, Guid reviewId, CancellationToken cancellationToken)
    {
        var review = await reviewRepository.GetByIdAsync(reviewId, cancellationToken)
            ?? throw new ReviewNotFoundException();

        // Segunda camada de defesa: uma avaliação só pode ser editada pelo
        // próprio morador que a criou ("não permitir avaliação anônima" +
        // autoria) — mesmo padrão de BookingService.GetOwnBookingOrThrowAsync.
        if (review.ResidentId != residentId)
        {
            throw new ReviewNotFoundException();
        }

        return review;
    }
}
