using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IBookingRepository"/>.</summary>
public sealed class InMemoryBookingRepository : IBookingRepository
{
    private readonly Dictionary<Guid, Booking> _bookings = new();

    public IReadOnlyCollection<Booking> Bookings => _bookings.Values.ToList();

    public Task<Booking?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_bookings.GetValueOrDefault(id));

    public Task<IReadOnlyList<Booking>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Booking>>(
            _bookings.Values.Where(b => b.ResidentId == residentId)
                .OrderByDescending(b => b.ScheduledDate).ThenByDescending(b => b.StartTime).ToList());

    public Task<IReadOnlyList<Booking>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Booking>>(
            _bookings.Values.Where(b => b.ProfessionalId == professionalId)
                .OrderByDescending(b => b.ScheduledDate).ThenByDescending(b => b.StartTime).ToList());

    public Task<IReadOnlyList<Booking>> ListHoldingByProfessionalIdAndDateAsync(
        Guid professionalId,
        DateOnly scheduledDate,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Booking>>(
            _bookings.Values
                .Where(b => b.ProfessionalId == professionalId && b.ScheduledDate == scheduledDate && b.OccupiesSlot)
                .ToList());

    public Task<IReadOnlyList<Booking>> ListConfirmedByScheduledDateRangeAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Booking>>(
            _bookings.Values
                .Where(b => b.Status == BookingStatus.Confirmed && b.ScheduledDate >= fromDate && b.ScheduledDate <= toDate)
                .OrderBy(b => b.ScheduledDate).ThenBy(b => b.StartTime)
                .ToList());

    public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
    {
        _bookings[booking.Id] = booking;
        return Task.CompletedTask;
    }
}
