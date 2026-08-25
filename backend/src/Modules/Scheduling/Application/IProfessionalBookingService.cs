using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>
/// Casos de uso self-service do profissional (PROMPT 08, fluxo do
/// profissional: "receber solicitação → aceitar ou recusar"). Diferente de
/// <see cref="IBookingService"/>, aqui os métodos recebem <c>professionalId</c>
/// já resolvido (<see cref="Domain.Booking.ProfessionalId"/> é o
/// <c>Professional.Id</c>, não o <c>User.Id</c> — este módulo não pode
/// referenciar o módulo Professional para resolver esse Id sozinho; é a
/// Api quem resolve, a partir do próprio perfil do usuário autenticado
/// (<c>IProfessionalProfileService.GetMyProfileAsync</c>), antes de chamar
/// qualquer método aqui — ver <c>ProfessionalBookingsController</c>).
/// </summary>
public interface IProfessionalBookingService
{
    /// <summary>React Native: ProfessionalRequestsScreen — "solicitações recebidas"; <paramref name="status"/> opcional filtra (ex.: só as ainda pendentes).</summary>
    Task<IReadOnlyList<BookingResponse>> ListMyRequestsAsync(Guid professionalId, BookingStatus? status, CancellationToken cancellationToken = default);

    Task<BookingResponse> GetMyRequestAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRequestsScreen — "aceitar".</summary>
    Task<BookingResponse> AcceptAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRequestsScreen — "recusar".</summary>
    Task<BookingResponse> RejectAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRequestsScreen/BookingDetailsScreen — "cancelar" (mesma regra de <see cref="Domain.Booking.CancelByProfessional"/>: só antes do atendimento começar).</summary>
    Task<BookingResponse> CancelAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>O profissional marca o início do atendimento.</summary>
    Task<BookingResponse> MarkInProgressAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRequestsScreen — "concluir".</summary>
    Task<BookingResponse> CompleteAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);

    /// <summary>O morador não compareceu ao horário confirmado.</summary>
    Task<BookingResponse> MarkNoShowAsync(Guid professionalId, Guid bookingId, CancellationToken cancellationToken = default);
}
