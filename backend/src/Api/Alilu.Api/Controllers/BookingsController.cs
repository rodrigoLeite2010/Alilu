using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Resident.Application;
using Alilu.Modules.Scheduling.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do morador (PROMPT 08 — "o módulo mais
/// crítico") — qualquer usuário autenticado pode chamar, sempre restrito
/// ao próprio usuário (<c>User.GetUserId()</c>), mesmo padrão de
/// <see cref="ResidentMembershipsController"/>.
///
/// Ponto de COMPOSIÇÃO para <see cref="Create"/>: nenhum dos três módulos
/// envolvidos (Resident/Professional/Scheduling) pode referenciar os
/// outros (PROMPT 01), então é aqui — a Api, composição raiz — que as
/// REGRAS CRÍTICAS do prompt que cruzam módulos são aplicadas, em
/// sequência, ANTES de deixar o módulo Scheduling criar o agendamento:
///
/// 1. "Só morador com Membership Active pode criar Booking" + "morador só
///    pode agendar para a própria Unit" — <see cref="IMembershipService.ValidateActiveMembershipAsync"/>
///    (módulo Resident).
/// 2. "Profissional deve atender o condomínio" — <see cref="IProfessionalDirectoryService.ValidateAttendsCondominiumAsync"/>
///    (módulo Professional).
/// 3. "O horário deve estar disponível" / "nunca confiar no calendário do
///    React Native" — <see cref="IProfessionalDirectoryService.ValidateAvailableAsync"/>
///    (módulo Professional — resolve agenda recorrente + exceções da
///    Etapa 07).
/// 4. Só então <see cref="IBookingService.CreateBookingAsync"/> (módulo
///    Scheduling) — que ainda garante sozinho, numa transação
///    <c>Serializable</c>, que nenhum outro agendamento deste profissional
///    colide com este horário ("não permitir conflitos" / "verificação de
///    conflito no servidor" / "transação e mecanismo de concorrência
///    adequado").
///
/// Se qualquer uma das três validações falhar, a criação nem chega a abrir
/// a transação do passo 4 — falha rápido, sem gastar uma conexão/transação
/// de banco numa requisição que já se sabe inválida.
/// </summary>
[ApiController]
[Route("api/resident/bookings")]
[Authorize]
public sealed class BookingsController(
    IBookingService bookingService,
    IMembershipService membershipService,
    IProfessionalDirectoryService professionalDirectoryService,
    INotificationDispatcher notificationDispatcher) : ControllerBase
{
    /// <summary>React Native: MyBookingsScreen.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BookingResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var bookings = await bookingService.ListMyBookingsAsync(User.GetUserId(), cancellationToken);
        return Ok(bookings);
    }

    /// <summary>React Native: BookingDetailsScreen.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BookingResponse>> GetMine(Guid id, CancellationToken cancellationToken)
    {
        var booking = await bookingService.GetMyBookingAsync(User.GetUserId(), id, cancellationToken);
        return Ok(booking);
    }

    /// <summary>
    /// React Native: BookingConfirmationScreen — passo final do fluxo do
    /// morador. Ver o comentário da classe para a sequência completa de
    /// composição/validação.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<BookingResponse>> Create([FromBody] CreateBookingBody body, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        await membershipService.ValidateActiveMembershipAsync(userId, body.CondominiumId, body.UnitId, cancellationToken);
        await professionalDirectoryService.ValidateAttendsCondominiumAsync(body.ProfessionalId, body.CondominiumId, cancellationToken);
        await professionalDirectoryService.ValidateAvailableAsync(
            body.ProfessionalId, body.ScheduledDate, body.StartTime, body.EndTime, cancellationToken);

        var booking = await bookingService.CreateBookingAsync(
            userId,
            body.ProfessionalId,
            body.CondominiumId,
            body.UnitId,
            body.ScheduledDate,
            body.StartTime,
            body.EndTime,
            body.Notes,
            body.Items.Select(item => new BookingItemInput(item.ServiceCategoryId, item.Description, item.Quantity)).ToList(),
            cancellationToken);

        // EVENTO "novo agendamento" (PROMPT 11) — para o profissional. O
        // User.Id do profissional não vem em nenhum DTO público (ver nota
        // em IProfessionalDirectoryService.GetProfessionalUserIdAsync); a
        // notificação em si nunca inclui dado sensível do morador (nome,
        // telefone, unidade) — só data/horário, o suficiente para o
        // profissional decidir.
        var professionalUserId = await professionalDirectoryService.GetProfessionalUserIdAsync(body.ProfessionalId, cancellationToken);
        await notificationDispatcher.NotifyAsync(
            professionalUserId,
            NotificationType.BookingCreated,
            "Novo agendamento recebido",
            $"Você recebeu uma nova solicitação de agendamento para {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm}.",
            booking.Id,
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, booking);
    }

    /// <summary>React Native: MyBookingsScreen/BookingDetailsScreen — "cancelar".</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<BookingResponse>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var booking = await bookingService.CancelMyBookingAsync(User.GetUserId(), id, cancellationToken);

        // EVENTO "agendamento cancelado" (PROMPT 11) — para o profissional
        // (foi o morador quem cancelou aqui; o caminho inverso é
        // ProfessionalBookingsController.Cancel, abaixo).
        var professionalUserId = await professionalDirectoryService.GetProfessionalUserIdAsync(booking.ProfessionalId, cancellationToken);
        await notificationDispatcher.NotifyAsync(
            professionalUserId,
            NotificationType.BookingCancelled,
            "Agendamento cancelado",
            $"O agendamento de {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm} foi cancelado pelo morador.",
            booking.Id,
            cancellationToken);

        return Ok(booking);
    }
}

/// <summary>Corpo de POST .../bookings — profissional/condomínio/unidade escolhidos pelo morador, sempre revalidados no servidor antes de criar o agendamento.</summary>
public sealed record CreateBookingBody(
    Guid ProfessionalId,
    Guid CondominiumId,
    Guid UnitId,
    DateOnly ScheduledDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    string? Notes,
    IReadOnlyList<BookingItemBody> Items);

/// <summary>Um serviço escolhido no passo "selecionar serviços" (React Native: BookingServicesScreen).</summary>
public sealed record BookingItemBody(Guid ServiceCategoryId, string? Description, int Quantity);
