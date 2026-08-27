using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service de disponibilidade (PROMPT 07) — qualquer usuário
/// autenticado pode chamar, sempre restrito ao próprio perfil profissional
/// (<c>User.GetUserId()</c>), mesmo padrão de
/// <see cref="ProfessionalProfileController"/>.
///
/// A lista de endpoints do PROMPT 07 pede um único GET ("GET
/// availability") — <see cref="GetMyAvailability"/> devolve a agenda
/// recorrente E as exceções numa única resposta
/// (<see cref="ProfessionalAvailabilityOverviewResponse"/>), servindo as
/// quatro telas React Native pedidas (AvailabilityScreen/AvailabilityEditor/
/// BlockedDatesScreen/CalendarAvailabilityScreen), que decidem sozinhas o
/// que exibir de cada parte — ver ARCHITECTURE.md.
/// </summary>
[ApiController]
[Route("api/professional/availability")]
[Authorize]
public sealed class ProfessionalAvailabilityController(IProfessionalAvailabilityService availabilityService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ProfessionalAvailabilityOverviewResponse>> GetMyAvailability(CancellationToken cancellationToken)
    {
        var overview = await availabilityService.GetMyAvailabilityAsync(User.GetUserId(), cancellationToken);
        return Ok(overview);
    }

    /// <summary>React Native: AvailabilityEditor — "configurar dias; configurar horários".</summary>
    [HttpPost]
    public async Task<ActionResult<ProfessionalAvailabilityResponse>> AddAvailability(
        [FromBody] SaveProfessionalAvailabilityBody body,
        CancellationToken cancellationToken)
    {
        var availability = await availabilityService.AddAvailabilityAsync(
            User.GetUserId(), body.DayOfWeek, body.StartTime, body.EndTime, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, availability);
    }

    /// <summary>React Native: AvailabilityEditor — edição de um intervalo já existente.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProfessionalAvailabilityResponse>> UpdateAvailability(
        Guid id,
        [FromBody] SaveProfessionalAvailabilityBody body,
        CancellationToken cancellationToken)
    {
        var availability = await availabilityService.UpdateAvailabilityAsync(
            User.GetUserId(), id, body.DayOfWeek, body.StartTime, body.EndTime, cancellationToken);
        return Ok(availability);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> RemoveAvailability(Guid id, CancellationToken cancellationToken)
    {
        await availabilityService.RemoveAvailabilityAsync(User.GetUserId(), id, cancellationToken);
        return NoContent();
    }

    /// <summary>React Native: BlockedDatesScreen — "bloquear datas; liberar horários específicos".</summary>
    [HttpPost("exceptions")]
    public async Task<ActionResult<ProfessionalAvailabilityExceptionResponse>> AddException(
        [FromBody] AddProfessionalAvailabilityExceptionBody body,
        CancellationToken cancellationToken)
    {
        var exception = await availabilityService.AddExceptionAsync(
            User.GetUserId(), body.Date, body.StartTime, body.EndTime, body.Type, body.Reason, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, exception);
    }

    [HttpDelete("exceptions/{id:guid}")]
    public async Task<IActionResult> RemoveException(Guid id, CancellationToken cancellationToken)
    {
        await availabilityService.RemoveExceptionAsync(User.GetUserId(), id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Etapa 19 — cadastro em massa (um ou mais dias da semana × um ou mais
    /// períodos, de uma vez só, opcionalmente limitado a um período de
    /// datas). React Native: telas "+ Adicionar disponibilidade" (atalhos
    /// Hoje/Esta semana/Este mês/Personalizado), "📅 Configurar rotina
    /// semanal" (repetir toda semana/repetir até uma data) e "Disponibilidade
    /// em massa" — as três só variam o que pré-preenchem antes de chamar este
    /// mesmo endpoint; ver comentário completo em
    /// <see cref="IProfessionalAvailabilityService.SetBulkAvailabilityAsync"/>.
    /// </summary>
    [HttpPost("bulk")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalAvailabilityResponse>>> SetBulkAvailability(
        [FromBody] SetBulkAvailabilityBody body,
        CancellationToken cancellationToken)
    {
        var created = await availabilityService.SetBulkAvailabilityAsync(
            User.GetUserId(), body.DaysOfWeek, body.Periods, body.EffectiveFrom, body.EffectiveUntil, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, created);
    }
}

/// <summary>Corpo de POST/PUT .../availability — usado tanto para criar quanto para editar um intervalo recorrente.</summary>
public sealed record SaveProfessionalAvailabilityBody(DayOfWeek DayOfWeek, TimeOnly StartTime, TimeOnly EndTime);

/// <summary>Corpo de POST .../availability/exceptions. <see cref="StartTime"/>/<see cref="EndTime"/> nulos em conjunto = dia inteiro.</summary>
public sealed record AddProfessionalAvailabilityExceptionBody(
    DateOnly Date,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    ProfessionalAvailabilityExceptionType Type,
    string? Reason);

/// <summary>Corpo de POST .../availability/bulk — ver <see cref="IProfessionalAvailabilityService.SetBulkAvailabilityAsync"/>.</summary>
public sealed record SetBulkAvailabilityBody(
    IReadOnlyList<DayOfWeek> DaysOfWeek,
    IReadOnlyList<AvailabilityPeriodInput> Periods,
    DateOnly? EffectiveFrom,
    DateOnly? EffectiveUntil);
