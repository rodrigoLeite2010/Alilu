using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>Implementação de <see cref="IProfessionalBookingService"/> — ver comentário de design/segurança lá.</summary>
public sealed class ProfessionalBookingService(
    IBookingRepository bookingRepository,
    IBookingItemRepository bookingItemRepository,
    IUnitOfWork unitOfWork) : IProfessionalBookingService
{
    public async Task<IReadOnlyList<BookingResponse>> ListMyRequestsAsync(Guid professionalId, BookingStatus? status, CancellationToken cancellationToken = default)
    {
        var bookings = await bookingRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);
        if (status is { } filterStatus)
        {
            bookings = bookings.Where(b => b.Status == filterStatus).ToList();
        }

        if (bookings.Count == 0)
        {
            return Array.Empty<BookingResponse>();
        }

        var itemsByBooking = (await bookingItemRepository.ListByBookingIdsAsync(bookings.Select(b => b.Id).ToList(), cancellationToken))
            .GroupBy(item => item.BookingId)
            .ToDictionary(group => group.Key, group => (IReadOnlyList<BookingItem>)group.ToList());

        return bookings
            .Select(booking => SchedulingMapper.ToResponse(booking, itemsByBooking.GetValueOrDefault(booking.Id, Array.Empty<BookingItem>())))
            .ToList();
    }

    public async Task<BookingResponse> GetMyRequestAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var booking = await GetOwnRequestOrThrowAsync(professionalId, bookingId, cancellationToken);
        var items = await bookingItemRepository.ListByBookingIdAsync(booking.Id, cancellationToken);
        return SchedulingMapper.ToResponse(booking, items);
    }

    public Task<BookingResponse> AcceptAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.Confirm(), cancellationToken);

    public Task<BookingResponse> RejectAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.Reject(), cancellationToken);

    public Task<BookingResponse> CancelAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.CancelByProfessional(), cancellationToken);

    public Task<BookingResponse> MarkInProgressAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.MarkInProgress(), cancellationToken);

    public Task<BookingResponse> CompleteAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.Complete(), cancellationToken);

    public Task<BookingResponse> MarkNoShowAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default) =>
        ApplyTransitionAsync(professionalId, bookingId, booking => booking.MarkNoShow(), cancellationToken);

    private async Task<BookingResponse> ApplyTransitionAsync(
        Guid professionalId,
        Guid bookingId,
        Action<Booking> transition,
        CancellationToken cancellationToken)
    {
        var booking = await GetOwnRequestOrThrowAsync(professionalId, bookingId, cancellationToken);

        transition(booking);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var items = await bookingItemRepository.ListByBookingIdAsync(booking.Id, cancellationToken);
        return SchedulingMapper.ToResponse(booking, items);
    }

    private async Task<Booking> GetOwnRequestOrThrowAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken)
    {
        var booking = await bookingRepository.GetByIdAsync(bookingId, cancellationToken)
            ?? throw new BookingNotFoundException();

        // Segunda camada de defesa: um agendamento só pode ser visto/agido
        // pelo próprio profissional para quem foi solicitado — mesmo padrão
        // de BookingService.GetOwnBookingOrThrowAsync.
        if (booking.ProfessionalId != professionalId)
        {
            throw new BookingNotFoundException();
        }

        return booking;
    }
}
