using Alilu.Modules.Reviews.Domain;

namespace Alilu.Modules.Reviews.Application;

/// <summary>Conversão Domain → DTO deste módulo — mesmo papel de <c>SchedulingMapper</c>/<c>ProfessionalMapper</c> nos demais módulos.</summary>
internal static class ReviewMapper
{
    public static ReviewResponse ToResponse(Review review) => new(
        review.Id,
        review.BookingId,
        review.ResidentId,
        review.ProfessionalId,
        review.Rating,
        review.Comment,
        review.CreatedAt);
}
