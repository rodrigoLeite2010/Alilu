using Alilu.Modules.Recommendations.Domain;

namespace Alilu.Modules.Recommendations.Application;

/// <summary>Conversão Domain → DTO deste módulo — mesmo papel de <c>ReviewMapper</c>/<c>SchedulingMapper</c> nos demais módulos.</summary>
internal static class RecommendationMapper
{
    public static RecommendationResponse ToResponse(Recommendation recommendation) => new(
        recommendation.Id,
        recommendation.CondominiumId,
        recommendation.RecommendedByUserId,
        recommendation.ProfessionalId,
        recommendation.ExternalProfessionalName,
        recommendation.ExternalPhone,
        recommendation.ServiceCategoryId,
        recommendation.Comment,
        recommendation.Status,
        recommendation.CreatedAt,
        recommendation.ApprovedAt,
        recommendation.ApprovedBy);
}
