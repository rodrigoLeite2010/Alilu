using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Scheduling.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IBookingItemRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class BookingItemRepository(AliluDbContext dbContext) : IBookingItemRepository
{
    public async Task<IReadOnlyList<BookingItem>> ListByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<BookingItem>()
            .Where(i => i.BookingId == bookingId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<BookingItem>> ListByBookingIdsAsync(IReadOnlyList<Guid> bookingIds, CancellationToken cancellationToken = default)
    {
        if (bookingIds.Count == 0)
        {
            return Array.Empty<BookingItem>();
        }

        return await dbContext.Set<BookingItem>()
            .Where(i => bookingIds.Contains(i.BookingId))
            .ToListAsync(cancellationToken);
    }

    public async Task AddRangeAsync(IEnumerable<BookingItem> items, CancellationToken cancellationToken = default) =>
        await dbContext.Set<BookingItem>().AddRangeAsync(items, cancellationToken);
}
