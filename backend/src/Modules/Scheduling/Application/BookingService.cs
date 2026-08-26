using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>Implementação de <see cref="IBookingService"/> — ver comentário de design/segurança lá.</summary>
public sealed class BookingService(
    IBookingRepository bookingRepository,
    IBookingItemRepository bookingItemRepository,
    IUnitOfWork unitOfWork) : IBookingService
{
    public async Task<IReadOnlyList<BookingResponse>> ListMyBookingsAsync(Guid residentId, CancellationToken cancellationToken = default)
    {
        var bookings = await bookingRepository.ListByResidentIdAsync(residentId, cancellationToken);
        return await ToResponsesAsync(bookings, cancellationToken);
    }

    public async Task<BookingResponse> GetMyBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var booking = await GetOwnBookingOrThrowAsync(residentId, bookingId, cancellationToken);
        var items = await bookingItemRepository.ListByBookingIdAsync(booking.Id, cancellationToken);
        return SchedulingMapper.ToResponse(booking, items);
    }

    public async Task<BookingResponse> CreateBookingAsync(
        Guid residentId,
        Guid professionalId,
        Guid condominiumId,
        Guid unitId,
        DateOnly scheduledDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string? notes,
        IReadOnlyList<BookingItemInput> items,
        CancellationToken cancellationToken = default)
    {
        if (items.Count == 0)
        {
            throw new InvalidBookingItemsException();
        }

        // "Verificação de conflito deve acontecer no servidor" / "deve usar
        // transação e mecanismo de concorrência adequado" (REGRAS CRÍTICAS):
        // a checagem abaixo (em memória) cobre o caso comum; a transação
        // Serializable é a rede de segurança para a corrida genuína entre
        // duas requisições concorrentes que a checagem sozinha não pega —
        // ver IUnitOfWork.ExecuteInSerializableTransactionAsync.
        return await unitOfWork.ExecuteInSerializableTransactionAsync(async ct =>
        {
            var sameDayBookings = await bookingRepository.ListHoldingByProfessionalIdAndDateAsync(professionalId, scheduledDate, ct);
            if (sameDayBookings.Any(existing => existing.OverlapsWith(professionalId, scheduledDate, startTime, endTime)))
            {
                throw new BookingConflictException();
            }

            var booking = Booking.Request(residentId, professionalId, condominiumId, unitId, scheduledDate, startTime, endTime, notes);
            await bookingRepository.AddAsync(booking, ct);

            var bookingItems = items
                .Select(item => BookingItem.Create(booking.Id, item.ServiceCategoryId, item.Description, item.Quantity))
                .ToList();
            await bookingItemRepository.AddRangeAsync(bookingItems, ct);

            await unitOfWork.SaveChangesAsync(ct);

            return SchedulingMapper.ToResponse(booking, bookingItems);
        }, cancellationToken);
    }

    public async Task<BookingResponse> CancelMyBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var booking = await GetOwnBookingOrThrowAsync(residentId, bookingId, cancellationToken);

        booking.CancelByResident();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var items = await bookingItemRepository.ListByBookingIdAsync(booking.Id, cancellationToken);
        return SchedulingMapper.ToResponse(booking, items);
    }

    public async Task<Guid> ValidateCompletedBookingForReviewAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default)
    {
        var booking = await GetOwnBookingOrThrowAsync(residentId, bookingId, cancellationToken);

        if (booking.Status != BookingStatus.Completed)
        {
            throw new BookingNotCompletedException();
        }

        return booking.ProfessionalId;
    }

    public async Task<IReadOnlyList<BookingResponse>> ListConfirmedBookingsByDateRangeAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        var bookings = await bookingRepository.ListConfirmedByScheduledDateRangeAsync(fromDate, toDate, cancellationToken);
        return await ToResponsesAsync(bookings, cancellationToken);
    }

    public async Task<IReadOnlyList<BookingResponse>> ListBookingsByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default)
    {
        var bookings = await bookingRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return await ToResponsesAsync(bookings, cancellationToken);
    }

    private async Task<Booking> GetOwnBookingOrThrowAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken)
    {
        var booking = await bookingRepository.GetByIdAsync(bookingId, cancellationToken)
            ?? throw new BookingNotFoundException();

        // Segunda camada de defesa: um agendamento só pode ser visto/
        // cancelado pelo próprio morador que o criou — mesmo padrão de
        // ProfessionalAvailabilityService.GetOwnAvailabilityOrThrowAsync.
        if (booking.ResidentId != residentId)
        {
            throw new BookingNotFoundException();
        }

        return booking;
    }

    private async Task<IReadOnlyList<BookingResponse>> ToResponsesAsync(IReadOnlyList<Booking> bookings, CancellationToken cancellationToken)
    {
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
}
