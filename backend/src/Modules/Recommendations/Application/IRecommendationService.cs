namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Casos de uso self-service do morador (PROMPT 10: "morador Active pode
/// recomendar") — qualquer usuário autenticado pode chamar, sempre
/// restrito ao próprio <c>recommendedByUserId</c>.
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar os módulos Resident/Professional. Por isso
/// <see cref="RecommendAsync"/> recebe <c>condominiumId</c> e
/// <c>professionalId</c> (quando aplicável) já resolvidos/validados por
/// quem chama — as REGRAS CRÍTICAS "morador Active pode recomendar" e "se o
/// profissional já existir no ALILU, vincular ProfessionalId" são
/// responsabilidade da Api (composição raiz), que chama
/// <c>IMembershipService.GetMyActiveMembershipAsync</c> (Resident) e
/// <c>IProfessionalDirectoryService.GetProfessionalProfileAsync</c>
/// (Professional) ANTES deste método — ver <c>RecommendationsController</c>
/// e ARCHITECTURE.md, "Etapa 10 — composição". A única regra que este
/// módulo garante sozinho é "não permitir spam ilimitado"
/// (<see cref="TooManyPendingRecommendationsException"/>).
/// </summary>
public interface IRecommendationService
{
    /// <summary>
    /// React Native: RecommendProfessionalScreen — "recomendar
    /// profissional". Lança <see cref="TooManyPendingRecommendationsException"/>
    /// quando o morador já tem recomendações demais aguardando moderação.
    /// </summary>
    Task<RecommendationResponse> RecommendAsync(
        Guid condominiumId,
        Guid recommendedByUserId,
        Guid? professionalId,
        string? externalProfessionalName,
        string? externalPhone,
        Guid serviceCategoryId,
        string comment,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: RecommendationsScreen — "minhas recomendações".</summary>
    Task<IReadOnlyList<RecommendationResponse>> ListMyRecommendationsAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default);

    /// <summary>React Native: RecommendationDetailsScreen. Lança <see cref="RecommendationNotFoundException"/> quando não existe ou não pertence a <paramref name="recommendedByUserId"/>.</summary>
    Task<RecommendationResponse> GetMyRecommendationAsync(Guid recommendedByUserId, Guid recommendationId, CancellationToken cancellationToken = default);
}
