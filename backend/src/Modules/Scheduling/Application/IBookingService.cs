using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>
/// Casos de uso self-service do morador (PROMPT 08) — qualquer usuário
/// autenticado pode chamar, sempre restrito ao próprio <c>userId</c>
/// (<see cref="Domain.Booking.ResidentId"/> é o próprio <c>User.Id</c> —
/// não há uma entidade "Resident" própria, mesma convenção de
/// <c>CondominiumMembership.UserId</c> no módulo Resident).
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar os módulos Resident/Professional/Condominium. Por isso
/// <see cref="CreateBookingAsync"/> recebe <c>professionalId</c>/
/// <c>condominiumId</c>/<c>unitId</c> já validados por quem chamou — nunca
/// confia neles sozinho. As REGRAS CRÍTICAS que dependem de outro módulo
/// ("só morador com Membership Active pode criar Booking", "morador só
/// pode agendar para a própria Unit", "profissional deve atender o
/// condomínio", "o horário deve estar disponível") são responsabilidade da
/// Api (composição raiz), que chama os módulos Resident/Professional
/// ANTES deste método — ver <c>BookingsController</c> e ARCHITECTURE.md.
/// A única regra de conflito que este módulo garante sozinho, dentro de
/// uma transação <c>Serializable</c>, é "nenhum outro agendamento deste
/// profissional, nesta data, colide com este horário" — ver
/// <see cref="Domain.Booking.OverlapsWith"/> e
/// <c>IUnitOfWork.ExecuteInSerializableTransactionAsync</c>.
/// </summary>
public interface IBookingService
{
    /// <summary>React Native: MyBookingsScreen — "meus agendamentos".</summary>
    Task<IReadOnlyList<BookingResponse>> ListMyBookingsAsync(Guid residentId, CancellationToken cancellationToken = default);

    /// <summary>React Native: BookingDetailsScreen.</summary>
    Task<BookingResponse> GetMyBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// React Native: BookingConfirmationScreen — passo final do fluxo do
    /// morador ("escolher profissional → escolher data → verificar
    /// disponibilidade → escolher horário → selecionar serviços →
    /// adicionar observações → enviar solicitação"). Nasce
    /// <see cref="BookingStatus.Requested"/>. Lança
    /// <see cref="InvalidBookingItemsException"/> quando <paramref name="items"/>
    /// está vazio e <see cref="BookingConflictException"/> quando o horário
    /// já está ocupado por outro agendamento deste profissional (checagem
    /// atômica, dentro da transação — ver comentário da interface).
    /// </summary>
    Task<BookingResponse> CreateBookingAsync(
        Guid residentId,
        Guid professionalId,
        Guid condominiumId,
        Guid unitId,
        DateOnly scheduledDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string? notes,
        IReadOnlyList<BookingItemInput> items,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: MyBookingsScreen/BookingDetailsScreen — "cancelar". Lança <see cref="Alilu.Shared.DomainException"/> (400) quando o agendamento já começou/terminou — ver <see cref="Domain.Booking.CancelByResident"/>.</summary>
    Task<BookingResponse> CancelMyBookingAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ponto de extensão para o módulo Reviews (PROMPT 09) validar, ANTES de
    /// criar/editar uma avaliação, que "somente Booking Completed pode ser
    /// avaliado" e "somente o Resident daquele Booking pode avaliar" — sem
    /// o módulo Reviews precisar referenciar este módulo (independência de
    /// módulos, PROMPT 01). É a Api (composição raiz, <c>ReviewsController</c>)
    /// quem chama este método antes de chamar <c>IReviewService</c> — mesmo
    /// papel de <c>IMembershipService.HasActiveMembershipAsync</c> na
    /// composição do PROMPT 08. Lança <see cref="BookingNotFoundException"/>
    /// quando o agendamento não existe ou não pertence a
    /// <paramref name="residentId"/>, e <see cref="BookingNotCompletedException"/>
    /// quando ainda não está <see cref="Domain.BookingStatus.Completed"/>.
    /// Devolve o <c>ProfessionalId</c> do agendamento, que o módulo Reviews
    /// precisa gravar na avaliação mas não tem como descobrir sozinho.
    /// </summary>
    Task<Guid> ValidateCompletedBookingForReviewAsync(Guid residentId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ponto de extensão para o módulo Notifications (Etapa 11) — "lembrete
    /// do serviço" — sem o módulo Notifications precisar referenciar este
    /// módulo (independência de módulos, PROMPT 01). É a Api
    /// (<c>BookingReminderBackgroundService</c>, composição raiz) quem
    /// chama isto periodicamente e decide, com o relógio (que este módulo
    /// não conhece — ver nota de <c>ScheduledDate</c>/<c>StartTime</c> sem
    /// fuso embutido no módulo Professional, Etapa 07), quais destes
    /// agendamentos já estão "próximos o bastante" para merecer um
    /// lembrete.
    /// </summary>
    Task<IReadOnlyList<BookingResponse>> ListConfirmedBookingsByDateRangeAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default);
}
