using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>Porta de persistência de <see cref="Booking"/>.</summary>
public interface IBookingRepository
{
    Task<Booking?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>React Native: MyBookingsScreen — "meus agendamentos" do morador, mais recente primeiro.</summary>
    Task<IReadOnlyList<Booking>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRequestsScreen — solicitações recebidas pelo profissional, mais recente primeiro.</summary>
    Task<IReadOnlyList<Booking>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Agendamentos deste profissional nesta data que ainda "seguram" a
    /// agenda (ver <see cref="Booking.OccupiesSlot"/>) — usado para checar
    /// conflito de horário antes de criar um novo agendamento
    /// (<see cref="IBookingService.CreateBookingAsync"/>).
    /// </summary>
    Task<IReadOnlyList<Booking>> ListHoldingByProfessionalIdAndDateAsync(
        Guid professionalId,
        DateOnly scheduledDate,
        CancellationToken cancellationToken = default);

    Task AddAsync(Booking booking, CancellationToken cancellationToken = default);
}
