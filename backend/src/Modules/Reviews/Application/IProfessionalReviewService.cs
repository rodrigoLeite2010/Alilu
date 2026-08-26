namespace Alilu.Modules.Reviews.Application;

/// <summary>
/// Casos de uso self-service do profissional (PROMPT 09: "visualizar
/// avaliações recebidas; visualizar média"). Assim como
/// <c>IProfessionalBookingService</c> (Scheduling), recebe
/// <c>professionalId</c> já resolvido pela Api a partir do perfil do
/// usuário autenticado (<c>IProfessionalProfileService.GetMyProfileAsync</c>)
/// — este módulo não pode referenciar o módulo Professional para resolver
/// esse Id sozinho.
/// </summary>
public interface IProfessionalReviewService
{
    /// <summary>React Native: ProfessionalReviewsScreen — "visualizar avaliações recebidas".</summary>
    Task<IReadOnlyList<ReviewResponse>> ListReceivedAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalReviewsScreen/RatingSummary — "visualizar média".</summary>
    Task<ProfessionalRatingSummaryResponse> GetRatingSummaryAsync(Guid professionalId, CancellationToken cancellationToken = default);
}
