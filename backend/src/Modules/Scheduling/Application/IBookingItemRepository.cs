using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>Porta de persistência de <see cref="BookingItem"/>.</summary>
public interface IBookingItemRepository
{
    /// <summary>Itens de um agendamento — usado para compor <see cref="BookingResponse"/> (React Native: BookingDetailsScreen/MyBookingsScreen/ProfessionalRequestsScreen).</summary>
    Task<IReadOnlyList<BookingItem>> ListByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>Itens de vários agendamentos de uma vez — evita N+1 ao listar (ver <see cref="IBookingService.ListMyBookingsAsync"/>/<see cref="IProfessionalBookingService.ListMyRequestsAsync"/>).</summary>
    Task<IReadOnlyList<BookingItem>> ListByBookingIdsAsync(IReadOnlyList<Guid> bookingIds, CancellationToken cancellationToken = default);

    Task AddRangeAsync(IEnumerable<BookingItem> items, CancellationToken cancellationToken = default);
}
