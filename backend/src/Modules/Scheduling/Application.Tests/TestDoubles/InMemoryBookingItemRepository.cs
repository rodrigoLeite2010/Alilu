using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IBookingItemRepository"/>.</summary>
public sealed class InMemoryBookingItemRepository : IBookingItemRepository
{
    private readonly List<BookingItem> _items = new();

    public Task<IReadOnlyList<BookingItem>> ListByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<BookingItem>>(_items.Where(i => i.BookingId == bookingId).ToList());

    public Task<IReadOnlyList<BookingItem>> ListByBookingIdsAsync(IReadOnlyList<Guid> bookingIds, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<BookingItem>>(_items.Where(i => bookingIds.Contains(i.BookingId)).ToList());

    public Task AddRangeAsync(IEnumerable<BookingItem> items, CancellationToken cancellationToken = default)
    {
        _items.AddRange(items);
        return Task.CompletedTask;
    }
}
