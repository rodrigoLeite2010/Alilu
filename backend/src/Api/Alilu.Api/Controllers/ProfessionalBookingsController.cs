using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do profissional (PROMPT 08) — fluxo
/// "receber solicitação → aceitar ou recusar".
///
/// Ponto de COMPOSIÇÃO (mais simples que <see cref="BookingsController"/>,
/// só um módulo envolvido além do Scheduling): <see cref="Domain.Booking.ProfessionalId"/>
/// é o <c>Professional.Id</c> (perfil, módulo Professional), não o
/// <c>User.Id</c> de quem está autenticado — como o módulo Scheduling não
/// pode referenciar o módulo Professional para resolver esse Id sozinho, é
/// aqui que a Api resolve o próprio perfil do usuário autenticado
/// (<see cref="IProfessionalProfileService.GetMyProfileAsync"/>) antes de
/// repassar o <c>professionalId</c> já resolvido para
/// <see cref="IProfessionalBookingService"/>.
/// </summary>
[ApiController]
[Route("api/professional/bookings")]
[Authorize]
public sealed class ProfessionalBookingsController(
    IProfessionalBookingService professionalBookingService,
    IProfessionalProfileService profileService,
    INotificationDispatcher notificationDispatcher) : ControllerBase
{
    /// <summary>React Native: ProfessionalRequestsScreen — "solicitações recebidas"; <paramref name="status"/> opcional filtra (ex.: <c>?status=Requested</c> só as pendentes).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BookingResponse>>> ListMine(
        [FromQuery] BookingStatus? status,
        CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var bookings = await professionalBookingService.ListMyRequestsAsync(professionalId, status, cancellationToken);
        return Ok(bookings);
    }

    /// <summary>React Native: BookingDetailsScreen (visão do profissional).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingResponse>> GetMine(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.GetMyRequestAsync(professionalId, id, cancellationToken);
        return Ok(booking);
    }

    /// <summary>React Native: ProfessionalRequestsScreen — "aceitar".</summary>
    [HttpPost("{id:guid}/accept")]
    public async Task<ActionResult<BookingResponse>> Accept(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.AcceptAsync(professionalId, id, cancellationToken);

        // EVENTO "agendamento aceito" (PROMPT 11) — para o morador.
        // Booking.ResidentId JÁ É o User.Id (não há entidade Resident
        // própria — ver nota de IBookingService), então nenhuma chamada a
        // outro módulo é necessária para resolver o destinatário.
        await notificationDispatcher.NotifyAsync(
            booking.ResidentId,
            NotificationType.BookingAccepted,
            "Agendamento aceito",
            $"Seu agendamento de {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm} foi aceito pelo profissional.",
            booking.Id,
            cancellationToken);

        return Ok(booking);
    }

    /// <summary>React Native: ProfessionalRequestsScreen — "recusar".</summary>
    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<BookingResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.RejectAsync(professionalId, id, cancellationToken);

        // EVENTO "agendamento rejeitado" (PROMPT 11) — para o morador.
        await notificationDispatcher.NotifyAsync(
            booking.ResidentId,
            NotificationType.BookingRejected,
            "Agendamento recusado",
            $"Seu agendamento de {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm} foi recusado pelo profissional.",
            booking.Id,
            cancellationToken);

        return Ok(booking);
    }

    /// <summary>React Native: ProfessionalRequestsScreen/BookingDetailsScreen — "cancelar".</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<BookingResponse>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.CancelAsync(professionalId, id, cancellationToken);

        // EVENTO "agendamento cancelado" (PROMPT 11) — para o morador (foi
        // o profissional quem cancelou aqui; o caminho inverso é
        // BookingsController.Cancel).
        await notificationDispatcher.NotifyAsync(
            booking.ResidentId,
            NotificationType.BookingCancelled,
            "Agendamento cancelado",
            $"O agendamento de {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm} foi cancelado pelo profissional.",
            booking.Id,
            cancellationToken);

        return Ok(booking);
    }

    /// <summary>O profissional marca o início do atendimento.</summary>
    [HttpPost("{id:guid}/start")]
    public async Task<ActionResult<BookingResponse>> Start(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.MarkInProgressAsync(professionalId, id, cancellationToken);
        return Ok(booking);
    }

    /// <summary>React Native: ProfessionalRequestsScreen — "concluir".</summary>
    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<BookingResponse>> Complete(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.CompleteAsync(professionalId, id, cancellationToken);

        // EVENTO "serviço concluído" (PROMPT 11) — para o morador.
        await notificationDispatcher.NotifyAsync(
            booking.ResidentId,
            NotificationType.ServiceCompleted,
            "Serviço concluído",
            $"O serviço de {booking.ScheduledDate:dd/MM/yyyy} foi marcado como concluído. Que tal avaliar o profissional?",
            booking.Id,
            cancellationToken);

        return Ok(booking);
    }

    /// <summary>O morador não compareceu ao horário confirmado.</summary>
    [HttpPost("{id:guid}/no-show")]
    public async Task<ActionResult<BookingResponse>> MarkNoShow(Guid id, CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var booking = await professionalBookingService.MarkNoShowAsync(professionalId, id, cancellationToken);
        return Ok(booking);
    }

    private async Task<Guid> ResolveMyProfessionalIdAsync(CancellationToken cancellationToken)
    {
        var profile = await profileService.GetMyProfileAsync(User.GetUserId(), cancellationToken)
            ?? throw new ProfessionalNotFoundException();

        return profile.Id;
    }
}
