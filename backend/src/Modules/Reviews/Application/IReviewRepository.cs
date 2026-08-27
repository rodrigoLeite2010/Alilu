using Alilu.Modules.Reviews.Domain;

namespace Alilu.Modules.Reviews.Application;

/// <summary>Porta de persistência de <see cref="Review"/>.</summary>
public interface IReviewRepository
{
    Task<Review?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>"Somente uma Review por Booking" — usado antes de criar, e por <see cref="IReviewService.GetMyReviewForBookingAsync"/> (React Native: BookingDetailsScreen decide "avaliar" vs. "ver avaliação").</summary>
    Task<Review?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 23 — "somente uma avaliação LIVRE por (Resident, Professional)"
    /// (mesmo espírito de <see cref="GetByBookingIdAsync"/>, só que pra
    /// avaliação sem agendamento): busca a avaliação com <c>BookingId</c>
    /// nulo daquele morador para aquele profissional, se existir. Usado
    /// antes de criar (duplicidade) e por
    /// <see cref="IReviewService.GetMyFreeReviewForProfessionalAsync"/>
    /// (React Native: ProfessionalProfileScreen decide "avaliar" vs.
    /// "ver/editar avaliação").
    /// </summary>
    Task<Review?> GetFreeReviewAsync(Guid residentId, Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ReviewScreen — "visualizar avaliações feitas" pelo morador, mais recente primeiro.</summary>
    Task<IReadOnlyList<Review>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalReviewsScreen — "visualizar avaliações recebidas", mais recente primeiro.</summary>
    Task<IReadOnlyList<Review>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    Task AddAsync(Review review, CancellationToken cancellationToken = default);
}
