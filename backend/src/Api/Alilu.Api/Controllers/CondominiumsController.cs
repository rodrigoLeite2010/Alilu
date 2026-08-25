using Alilu.Modules.Condominium.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de condomínios e unidades (PROMPT 04). Todo o
/// controller exige papel CondominiumAdmin ou SuperAdmin — "Não permitir
/// que usuário comum crie condomínios" também se aplica, por segurança
/// (endpoints administrativos, não expostos a Resident/Professional), aos
/// demais endpoints aqui (listar, criar unidade, criar convite). A
/// Application (<see cref="CondominiumService"/>) repete essa checagem como
/// segunda camada de defesa.
/// </summary>
[ApiController]
[Route("api/admin/condominiums")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class CondominiumsController(ICondominiumService condominiumService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CondominiumResponse>> Create(
        [FromBody] CreateCondominiumRequest request,
        CancellationToken cancellationToken)
    {
        var condominium = await condominiumService.CreateCondominiumAsync(
            User.GetCondominiumRequesterRole(), request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, condominium);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CondominiumResponse>>> List(CancellationToken cancellationToken)
    {
        var condominiums = await condominiumService.ListCondominiumsAsync(
            User.GetCondominiumRequesterRole(), cancellationToken);
        return Ok(condominiums);
    }

    [HttpPost("{condominiumId:guid}/units")]
    public async Task<ActionResult<CondominiumUnitResponse>> CreateUnit(
        Guid condominiumId,
        [FromBody] CreateUnitBody body,
        CancellationToken cancellationToken)
    {
        var unit = await condominiumService.CreateUnitAsync(
            User.GetCondominiumRequesterRole(),
            new CreateUnitRequest(condominiumId, body.Code, body.Type),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, unit);
    }

    [HttpGet("{condominiumId:guid}/units")]
    public async Task<ActionResult<IReadOnlyList<CondominiumUnitResponse>>> ListUnits(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var units = await condominiumService.ListUnitsAsync(
            User.GetCondominiumRequesterRole(), condominiumId, cancellationToken);
        return Ok(units);
    }

    [HttpPost("{condominiumId:guid}/invitations")]
    public async Task<ActionResult<CondominiumInvitationCreatedResponse>> CreateInvitation(
        Guid condominiumId,
        [FromBody] CreateInvitationBody body,
        CancellationToken cancellationToken)
    {
        var invitation = await condominiumService.CreateInvitationAsync(
            User.GetCondominiumRequesterRole(),
            new CreateInvitationRequest(condominiumId, body.UnitId, body.Email, body.ExpirationDays),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, invitation);
    }
}

/// <summary>Corpo de POST .../units — CondominiumId já vem da rota.</summary>
public sealed record CreateUnitBody(string Code, Alilu.Modules.Condominium.Domain.UnitType Type);

/// <summary>Corpo de POST .../invitations — CondominiumId já vem da rota.</summary>
public sealed record CreateInvitationBody(Guid UnitId, string Email, int? ExpirationDays);
