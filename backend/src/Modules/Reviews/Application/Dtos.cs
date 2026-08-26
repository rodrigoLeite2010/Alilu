namespace Alilu.Modules.Reviews.Application;

/// <summary>
/// Nunca inclui dados de outro módulo (nome do morador/profissional,
/// serviço do agendamento) — só os Ids, exatamente como a entidade os
/// guarda. Enriquecer para exibição é responsabilidade da Api — mesma
/// decisão de <c>BookingResponse</c> (Scheduling) e demais módulos.
/// </summary>
public sealed record ReviewResponse(
    Guid Id,
    Guid BookingId,
    Guid ResidentId,
    Guid ProfessionalId,
    int Rating,
    string? Comment,
    DateTime CreatedAt);

/// <summary>React Native: ProfessionalReviewsScreen/RatingSummary — "visualizar média". <see cref="TotalReviews"/> zero implica <see cref="AverageRating"/> zero (sem divisão por zero).</summary>
public sealed record ProfessionalRatingSummaryResponse(
    Guid ProfessionalId,
    int TotalReviews,
    double AverageRating);
