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

    /// <summary>
    /// Ponto de extensão para o módulo Notifications (Etapa 11) — "lembrete
    /// do serviço" — listar agendamentos Confirmed cuja <c>ScheduledDate</c>
    /// cai no intervalo <c>[fromDate, toDate]</c> (inclusive), sem o módulo
    /// Notifications precisar referenciar este módulo. Devolve entidades
    /// completas (não <c>BookingResponse</c>) porque só é chamado por
    /// <see cref="IBookingService.ListConfirmedBookingsByDateRangeAsync"/>,
    /// dentro do próprio módulo.
    /// </summary>
    Task<IReadOnlyList<Booking>> ListConfirmedByScheduledDateRangeAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default);

    Task AddAsync(Booking booking, CancellationToken cancellationToken = default);
}
