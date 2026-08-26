namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Casos de uso administrativos deste módulo ("Administrador pode
/// moderar" — PROMPT 10) — mesmo raciocínio de
/// <c>Alilu.Modules.Resident.Application.IMembershipAdministrationService</c>/
/// <c>Alilu.Modules.Professional.Application.IProfessionalAdministrationService</c>.
/// Toda operação aqui começa com uma checagem de papel (<c>EnsureIsAdmin</c>),
/// mesmo padrão dos demais módulos.
///
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO) acrescentou <c>scopeCondominiumId</c> a
/// cada operação — resolvido pela Api via
/// <c>Administration.Application.IAdminScopeService</c> (nunca confiando no
/// que o frontend envia). Parâmetro opcional (nulo = sem restrição,
/// comportamento das etapas anteriores) para não quebrar nenhum chamador
/// existente — SuperAdmin sempre passa nulo.
/// </summary>
public interface IRecommendationAdministrationService
{
    /// <summary>Fila de recomendações aguardando moderação.</summary>
    Task<IReadOnlyList<RecommendationResponse>> ListPendingAsync(
        RecommendationRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 12 — todas as recomendações (qualquer status) de um condomínio;
    /// suporte necessário para "bloquear" (achar uma já Approved) e para o
    /// dashboard administrativo, não um item separado da lista de
    /// FUNCIONALIDADES do prompt.
    /// </summary>
    Task<IReadOnlyList<RecommendationResponse>> ListByCondominiumAsync(
        RecommendationRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary><see cref="Domain.Recommendation.ApprovedBy"/> guarda quem aprovou — por isso, ao contrário de <see cref="RejectAsync"/>/<see cref="BlockAsync"/>, recebe o Id do administrador.</summary>
    Task<RecommendationResponse> ApproveAsync(
        RecommendationRequesterRole requesterRole,
        Guid adminUserId,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    Task<RecommendationResponse> RejectAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Bloqueia uma recomendação já aprovada (ex.: denúncia).</summary>
    Task<RecommendationResponse> BlockAsync(
        RecommendationRequesterRole requesterRole,
        Guid recommendationId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);
}
