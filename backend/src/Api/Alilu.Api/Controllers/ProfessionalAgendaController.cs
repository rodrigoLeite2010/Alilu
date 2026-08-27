using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Etapa 19 (agenda e disponibilidade) — "Minha Agenda": visão unificada por
/// data/período do que está Disponível/Agendado/Bloqueado/Indisponível,
/// pedida explicitamente pelo produto ("uma tela só, simples, sem termos
/// técnicos — pensando numa diarista"). Ponto de COMPOSIÇÃO (mesmo padrão de
/// <see cref="ProfessionalBookingsController"/>): o módulo Professional não
/// pode referenciar o módulo Scheduling (nem o contrário), então é aqui — na
/// Api, a única camada que enxerga os dois — que
/// <see cref="IProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/>
/// (disponibilidade/bloqueios) é cruzado com
/// <see cref="IProfessionalBookingService.ListMyRequestsAsync"/>
/// (agendamentos) para montar a resposta final.
///
/// Bucketiza cada data nos três períodos padrão
/// (<see cref="ProfessionalAvailabilityPeriods.All"/> — Manhã/Tarde/Noite)
/// em vez de expor as janelas "cruas" (que podem ter qualquer horário, ex.:
/// 09:30-11:15): SIMPLIFICAÇÃO DELIBERADA só para esta tela resumida — quem
/// precisa do horário exato continua usando <c>GET .../availability</c>
/// (agenda recorrente completa) ou <c>GET .../bookings</c> (agendamentos
/// completos); ver ARCHITECTURE.md, "Etapa 19".
/// </summary>
[ApiController]
[Route("api/professional/agenda")]
[Authorize]
public sealed class ProfessionalAgendaController(
    IProfessionalAvailabilityService availabilityService,
    IProfessionalProfileService profileService,
    IProfessionalBookingService professionalBookingService) : ControllerBase
{
    /// <summary>React Native: MyAgendaScreen — "Minha Agenda". <paramref name="from"/>/<paramref name="to"/> em query string (ex.: <c>?from=2026-09-01&amp;to=2026-09-30</c>); mesmo limite de 62 dias de <see cref="IProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/> (que lança <see cref="Alilu.Shared.DomainException"/>, traduzido para 400 pelo middleware, se excedido).</summary>
    [HttpGet("minha-agenda")]
    public async Task<ActionResult<IReadOnlyList<AgendaDayResponse>>> GetMyAgenda(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken cancellationToken)
    {
        var profile = await profileService.GetMyProfileAsync(User.GetUserId(), cancellationToken)
            ?? throw new ProfessionalNotFoundException();

        var dailyWindows = await availabilityService.GetMyOpenWindowsRangeAsync(User.GetUserId(), from, to, cancellationToken);

        // ListMyRequestsAsync não filtra por data (não existe hoje, no
        // módulo Scheduling, um método "meus agendamentos num intervalo de
        // datas") — o filtro por [from, to] é feito aqui, em memória, mesmo
        // raciocínio de volume-por-profissional-é-baixo de
        // ProfessionalDirectoryController.ListAvailableDates.
        var bookings = await professionalBookingService.ListMyRequestsAsync(profile.Id, status: null, cancellationToken);
        var bookingsByDate = bookings
            .Where(booking => booking.ScheduledDate >= from && booking.ScheduledDate <= to && IsHoldingSlot(booking.Status))
            .ToLookup(booking => booking.ScheduledDate);

        var days = dailyWindows
            .Select(day => new AgendaDayResponse(
                day.Date,
                ProfessionalAvailabilityPeriods.All
                    .Select(period => new AgendaPeriodResponse(
                        period.Name,
                        period.Start,
                        period.End,
                        ResolvePeriodStatus(period, day, bookingsByDate[day.Date])))
                    .ToList()))
            .ToList();

        return Ok(days);
    }

    /// <summary>
    /// PRIORIDADE (pedido explícito do produto — "Agendamento confirmado &gt;
    /// Bloqueio manual &gt; Disponibilidade específica &gt; Disponibilidade
    /// recorrente"; adaptado aqui porque <see cref="OpenWindowResolver"/> já
    /// funde as duas disponibilidades numa única lista de janelas livres):
    /// <see cref="AgendaPeriodStatus.Scheduled"/> &gt;
    /// <see cref="AgendaPeriodStatus.Blocked"/> &gt;
    /// <see cref="AgendaPeriodStatus.Available"/> &gt;
    /// <see cref="AgendaPeriodStatus.Unavailable"/>. Um período conta como
    /// "tocado" por uma janela quando há QUALQUER sobreposição (não precisa
    /// cobrir o período padrão inteiro) — bucketizar em 3 faixas fixas já é,
    /// por si só, uma simplificação da UI; exigir cobertura total só
    /// deixaria mais períodos "Indisponível" sem necessidade real.
    /// </summary>
    private static AgendaPeriodStatus ResolvePeriodStatus(
        StandardPeriod period,
        DailyOpenWindowsResponse day,
        IEnumerable<BookingResponse> bookingsOnDate)
    {
        if (bookingsOnDate.Any(booking => Overlaps(period.Start, period.End, booking.StartTime, booking.EndTime)))
        {
            return AgendaPeriodStatus.Scheduled;
        }

        if (day.BlockedWindows.Any(window => Overlaps(period.Start, period.End, window.StartTime, window.EndTime)))
        {
            return AgendaPeriodStatus.Blocked;
        }

        if (day.OpenWindows.Any(window => Overlaps(period.Start, period.End, window.StartTime, window.EndTime)))
        {
            return AgendaPeriodStatus.Available;
        }

        return AgendaPeriodStatus.Unavailable;
    }

    /// <summary>[a,b) sobrepõe [c,d) quando a &lt; d e c &lt; b — mesma fórmula do restante do domínio (ver <c>ProfessionalAvailability.OverlapsWith</c>/<c>Booking.OverlapsWith</c>).</summary>
    private static bool Overlaps(TimeOnly aStart, TimeOnly aEnd, TimeOnly bStart, TimeOnly bEnd) =>
        aStart < bEnd && bStart < aEnd;

    /// <summary>
    /// Espelha <see cref="Booking.OccupiesSlot"/> — o módulo Scheduling não
    /// vaza esse booleano em <see cref="BookingResponse"/> (só o
    /// <see cref="BookingStatus"/> cru, mesma decisão de nunca expor
    /// comportamento de domínio num DTO). Mudar os status considerados
    /// "segurando o horário" exige mudar os dois lugares.
    /// </summary>
    private static bool IsHoldingSlot(BookingStatus status) =>
        status is BookingStatus.Requested or BookingStatus.Confirmed or BookingStatus.InProgress or BookingStatus.Completed;
}

/// <summary>Um dia inteiro na "Minha Agenda" — um <see cref="AgendaPeriodResponse"/> por período padrão (<see cref="ProfessionalAvailabilityPeriods.All"/>).</summary>
public sealed record AgendaDayResponse(DateOnly Date, IReadOnlyList<AgendaPeriodResponse> Periods);

/// <summary>Um período (Manhã/Tarde/Noite) de um dia, com o status já resolvido — React Native: MyAgendaScreen (um ícone por status).</summary>
public sealed record AgendaPeriodResponse(string Name, TimeOnly StartTime, TimeOnly EndTime, AgendaPeriodStatus Status);

/// <summary>Ordem de prioridade — ver <see cref="ProfessionalAgendaController.ResolvePeriodStatus"/>.</summary>
public enum AgendaPeriodStatus
{
    Available,
    Scheduled,
    Blocked,
    Unavailable,
}
