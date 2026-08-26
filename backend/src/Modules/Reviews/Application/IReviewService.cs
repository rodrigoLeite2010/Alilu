namespace Alilu.Modules.Reviews.Application;

/// <summary>
/// Casos de uso self-service do morador (PROMPT 09) — qualquer usuário
/// autenticado pode chamar, sempre restrito ao próprio <c>residentId</c>.
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar o módulo Scheduling. Por isso <see cref="CreateAsync"/>
/// recebe <c>professionalId</c> já resolvido, e as REGRAS CRÍTICAS "somente
/// Booking Completed pode ser avaliado" e "somente o Resident daquele
/// Booking pode avaliar" são responsabilidade da Api (composição raiz), que
/// chama <c>IBookingService.ValidateCompletedBookingForReviewAsync</c>
/// ANTES deste método — ver <c>ReviewsController</c> e ARCHITECTURE.md,
/// "Etapa 09 — composição". A única regra que este módulo garante sozinho é
/// "somente uma Review por Booking" (<see cref="DuplicateReviewException"/>).
/// </summary>
public interface IReviewService
{
    /// <summary>React Native: ReviewScreen — "avaliar profissional". Lança <see cref="DuplicateReviewException"/> quando o agendamento já foi avaliado.</summary>
    Task<ReviewResponse> CreateAsync(
        Guid residentId,
        Guid bookingId,
        Guid professionalId,
        int rating,
        string? comment,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: ReviewScreen — "editar avaliação dentro da regra definida" (mesma regra de autoria da criação: só quem avaliou pode editar). Lança <see cref="ReviewNotFoundException"/> quando não existe ou não pertence a <paramref name="residentId"/>.</summary>
    Task<ReviewResponse> EditAsync(
        Guid residentId,
        Guid reviewId,
        int rating,
        string? comment,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: ReviewScreen — "visualizar avaliações feitas".</summary>
    Task<IReadOnlyList<ReviewResponse>> ListMyReviewsAsync(Guid residentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Devolve a avaliação do morador para este agendamento, ou <c>null</c>
    /// quando ainda não existe — mesmo padrão "204 sem corpo" de
    /// <c>IMembershipService.GetMyActiveMembershipAsync</c>/
    /// <c>IProfessionalProfileService.GetMyProfileAsync</c>. React Native:
    /// a rota hospedeira usa isso para decidir se ReviewScreen abre em modo
    /// "avaliar" ou "ver/editar avaliação".
    /// </summary>
    Task<ReviewResponse?> GetMyReviewForBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default);
}
