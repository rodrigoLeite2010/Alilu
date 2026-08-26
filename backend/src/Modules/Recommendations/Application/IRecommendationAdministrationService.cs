namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Casos de uso administrativos deste módulo ("Administrador pode
/// moderar" — PROMPT 10) — mesmo raciocínio de
/// <c>Alilu.Modules.Resident.Application.IMembershipAdministrationService</c>/
/// <c>Alilu.Modules.Professional.Application.IProfessionalAdministrationService</c>.
/// Toda operação aqui começa com uma checagem de papel (<c>EnsureIsAdmin</c>),
/// mesmo padrão dos demais módulos.
/// </summary>
public interface IRecommendationAdministrationService
{
    /// <summary>Fila de recomendações aguardando moderação.</summary>
    Task<IReadOnlyList<RecommendationResponse>> ListPendingAsync(
        RecommendationRequesterRole requesterRole,
        CancellationToken cancellationToken = default);

    /// <summary><see cref="Domain.Recommendation.ApprovedBy"/> guarda quem aprovou — por isso, ao contrário de <see cref="RejectAsync"/>/<see cref="BlockAsync"/>, recebe o Id do administrador.</summary>
    Task<RecommendationResponse> ApproveAsync(
        RecommendationRequesterRole requesterRole,
        Guid adminUserId,
        Guid recommendationId,
        CancellationToken cancellationToken = default);

    Task<RecommendationResponse> RejectAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        CancellationToken cancellationToken = default);

    /// <summary>Bloqueia uma recomendação já aprovada (ex.: denúncia).</summary>
    Task<RecommendationResponse> BlockAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        CancellationToken cancellationToken = default);
}
