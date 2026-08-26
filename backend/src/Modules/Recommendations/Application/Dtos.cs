using Alilu.Modules.Recommendations.Domain;

namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Nunca inclui dados de outro módulo (nome do morador, nome/foto do
/// profissional) — só os Ids, exatamente como a entidade os guarda.
/// Enriquecer para exibição é responsabilidade da Api — mesma decisão de
/// <c>ReviewResponse</c> (Reviews) e demais módulos.
/// </summary>
public sealed record RecommendationResponse(
    Guid Id,
    Guid CondominiumId,
    Guid RecommendedByUserId,
    Guid? ProfessionalId,
    string? ExternalProfessionalName,
    string? ExternalPhone,
    Guid ServiceCategoryId,
    string Comment,
    RecommendationStatus Status,
    DateTime CreatedAt,
    DateTime? ApprovedAt,
    Guid? ApprovedBy);

/// <summary>
/// React Native: ProfessionalRecommendationsScreen — "Recomendado por N
/// moradores". Conta só recomendações <see cref="RecommendationStatus.Approved"/>
/// (Pending ainda não foi moderada; Rejected/Blocked não deveriam contar a
/// favor do profissional).
/// </summary>
public sealed record ProfessionalRecommendationSummaryResponse(
    Guid ProfessionalId,
    int TotalApproved);
