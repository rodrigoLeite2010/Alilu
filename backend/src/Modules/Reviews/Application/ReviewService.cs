using Alilu.Modules.Reviews.Domain;

namespace Alilu.Modules.Reviews.Application;

/// <summary>Implementação de <see cref="IReviewService"/> — ver comentário de design/segurança lá.</summary>
public sealed class ReviewService(
    IReviewRepository reviewRepository,
    IUnitOfWork unitOfWork) : IReviewService
{
    public async Task<ReviewResponse> CreateAsync(
        Guid residentId,
        Guid? bookingId,
        Guid professionalId,
        int rating,
        string? comment,
        CancellationToken cancellationToken = default)
    {
        // Checagem em memória (o caso comum) — o índice único (em
        // BookingId, ou o parcial em (ResidentId, ProfessionalId) pra
        // avaliação livre — Etapa 23) é a rede de segurança para a corrida
        // genuína entre duas requisições concorrentes, mesmo espírito do
        // conflito de horário do módulo Scheduling, sem precisar de uma
        // transação Serializable (não há aqui uma janela de disponibilidade
        // a proteger, só uma unicidade simples).
        var existing = bookingId is { } id
            ? await reviewRepository.GetByBookingIdAsync(id, cancellationToken)
            : await reviewRepository.GetFreeReviewAsync(residentId, professionalId, cancellationToken);
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

    public async Task<ReviewResponse?> GetMyFreeReviewForProfessionalAsync(Guid residentId, Guid professionalId, CancellationToken cancellationToken = default)
    {
        // Sem a segunda camada de defesa "review.ResidentId != residentId"
        // de GetMyReviewForBookingAsync porque a busca já filtra por
        // residentId na própria query (GetFreeReviewAsync) — não existe
        // como vazar a avaliação de outro morador aqui.
        var review = await reviewRepository.GetFreeReviewAsync(residentId, professionalId, cancellationToken);
        return review is null ? null : ReviewMapper.ToResponse(review);
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
