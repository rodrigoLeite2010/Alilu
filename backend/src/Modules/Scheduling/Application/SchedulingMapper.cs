using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>Conversão Domain → DTO deste módulo — mesmo papel de <c>ProfessionalMapper</c>/<c>MembershipMapper</c> nos demais módulos.</summary>
internal static class SchedulingMapper
{
    public static BookingItemResponse ToResponse(BookingItem item) => new(
        item.Id,
        item.BookingId,
        item.ServiceCategoryId,
        item.Description,
        item.Quantity);

    public static BookingResponse ToResponse(Booking booking, IReadOnlyList<BookingItem> items) => new(
        booking.Id,
        booking.ResidentId,
        booking.ProfessionalId,
        booking.CondominiumId,
        booking.UnitId,
        booking.ScheduledDate,
        booking.StartTime,
        booking.EndTime,
        booking.Status,
        booking.Notes,
        booking.CreatedAt,
        booking.UpdatedAt,
        items.Select(ToResponse).ToList());
}
