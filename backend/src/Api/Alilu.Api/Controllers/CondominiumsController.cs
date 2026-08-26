using Alilu.Modules.Administration.Application;
using Alilu.Modules.Condominium.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de condomínios e unidades (PROMPT 04,
/// estendido na Etapa 12 / PROMPT 12). Todo o controller exige papel
/// CondominiumAdmin ou SuperAdmin — "Não permitir que usuário comum crie
/// condomínios" também se aplica, por segurança (endpoints administrativos,
/// não expostos a Resident/Professional), aos demais endpoints aqui
/// (listar, criar/editar/bloquear unidade, criar convite). A Application
/// (<see cref="CondominiumService"/>) repete essa checagem como segunda
/// camada de defesa.
///
/// Etapa 12 (AUTORIZAÇÃO): todo endpoint (exceto <see cref="Create"/>, que
/// virou SuperAdmin-only — ver <see cref="ICondominiumService.CreateCondominiumAsync"/>)
/// resolve primeiro o escopo do usuário autenticado via
/// <see cref="IAdminScopeService"/> e passa <c>scope.CondominiumId</c> para
/// a Application — nunca confia num <c>condominiumId</c> vindo da rota
/// sozinho para decidir o que o usuário PODE acessar (só para dizer o QUE
/// ele quer acessar; a Application confere se ele PODE).
/// </summary>
[ApiController]
[Route("api/admin/condominiums")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class CondominiumsController(
    ICondominiumService condominiumService,
    IAdminScopeService adminScopeService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CondominiumResponse>> Create(
        [FromBody] CreateCondominiumRequest request,
        CancellationToken cancellationToken)
    {
        // Sem resolução de escopo aqui de propósito: criar um condomínio
        // NOVO não é "administrar o meu condomínio" — é SuperAdmin-only,
        // checado dentro da própria Application.
        var condominium = await condominiumService.CreateCondominiumAsync(
            User.GetCondominiumRequesterRole(), request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, condominium);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CondominiumResponse>>> List(CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var condominiums = await condominiumService.ListCondominiumsAsync(
            User.GetCondominiumRequesterRole(), scope.CondominiumId, cancellationToken);
        return Ok(condominiums);
    }

    [HttpPost("{condominiumId:guid}/units")]
    public async Task<ActionResult<CondominiumUnitResponse>> CreateUnit(
        Guid condominiumId,
        [FromBody] CreateUnitBody body,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var unit = await condominiumService.CreateUnitAsync(
            User.GetCondominiumRequesterRole(),
            new CreateUnitRequest(condominiumId, body.Code, body.Type),
            scope.CondominiumId,
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, unit);
    }

    [HttpGet("{condominiumId:guid}/units")]
    public async Task<ActionResult<IReadOnlyList<CondominiumUnitResponse>>> ListUnits(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var units = await condominiumService.ListUnitsAsync(
            User.GetCondominiumRequesterRole(), condominiumId, scope.CondominiumId, cancellationToken);
        return Ok(units);
    }

    /// <summary>"Unidades: visualizar morador vinculado" (PROMPT 12), parte da unidade — ver <see cref="AdminMembershipsController.GetActiveMembershipByUnit"/> para o morador vinculado.</summary>
    [HttpGet("units/{unitId:guid}")]
    public async Task<ActionResult<CondominiumUnitResponse>> GetUnit(Guid unitId, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var unit = await condominiumService.GetUnitAsync(
            User.GetCondominiumRequesterRole(), unitId, scope.CondominiumId, cancellationToken);
        return Ok(unit);
    }

    /// <summary>"Unidades: editar" (PROMPT 12).</summary>
    [HttpPut("units/{unitId:guid}")]
    public async Task<ActionResult<CondominiumUnitResponse>> EditUnit(
        Guid unitId,
        [FromBody] EditUnitBody body,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var unit = await condominiumService.EditUnitAsync(
            User.GetCondominiumRequesterRole(),
            new EditUnitRequest(unitId, body.Code, body.Type),
            scope.CondominiumId,
            cancellationToken);
        return Ok(unit);
    }

    /// <summary>"Unidades: bloquear" (PROMPT 12).</summary>
    [HttpPost("units/{unitId:guid}/block")]
    public async Task<ActionResult<CondominiumUnitResponse>> BlockUnit(Guid unitId, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var unit = await condominiumService.BlockUnitAsync(
            User.GetCondominiumRequesterRole(), unitId, scope.CondominiumId, cancellationToken);
        return Ok(unit);
    }

    [HttpPost("{condominiumId:guid}/invitations")]
    public async Task<ActionResult<CondominiumInvitationCreatedResponse>> CreateInvitation(
        Guid condominiumId,
        [FromBody] CreateInvitationBody body,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var invitation = await condominiumService.CreateInvitationAsync(
            User.GetCondominiumRequesterRole(),
            new CreateInvitationRequest(condominiumId, body.UnitId, body.Email, body.ExpirationDays),
            scope.CondominiumId,
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, invitation);
    }

    private Task<AdminScope> ResolveScopeAsync(CancellationToken cancellationToken) =>
        adminScopeService.ResolveScopeAsync(User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);
}

/// <summary>Corpo de POST .../units — CondominiumId já vem da rota.</summary>
public sealed record CreateUnitBody(string Code, Alilu.Modules.Condominium.Domain.UnitType Type);

/// <summary>Corpo de PUT .../units/{unitId} (PROMPT 12) — CondominiumId não pode ser alterado (ver <see cref="EditUnitRequest"/>).</summary>
public sealed record EditUnitBody(string Code, Alilu.Modules.Condominium.Domain.UnitType Type);

/// <summary>Corpo de POST .../invitations — CondominiumId já vem da rota.</summary>
public sealed record CreateInvitationBody(Guid UnitId, string Email, int? ExpirationDays);
