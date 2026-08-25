using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de vínculo morador↔condomínio↔unidade
/// (PROMPT 05, FLUXO 2) — decisão sobre solicitações pendentes e bloqueio
/// de vínculos já ativos. Todo o controller exige papel CondominiumAdmin
/// ou SuperAdmin (mesmo padrão de <see cref="CondominiumsController"/>); a
/// Application (<see cref="MembershipAdministrationService"/>) repete essa
/// checagem como segunda camada de defesa.
/// </summary>
[ApiController]
[Route("api/admin/memberships")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminMembershipsController(IMembershipAdministrationService membershipAdministrationService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<MembershipResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var pending = await membershipAdministrationService.ListPendingAsync(
            User.GetResidentRequesterRole(), cancellationToken);
        return Ok(pending);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<MembershipResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var membership = await membershipAdministrationService.ApproveAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, cancellationToken);
        return Ok(membership);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<MembershipResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var membership = await membershipAdministrationService.RejectAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, cancellationToken);
        return Ok(membership);
    }

    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<MembershipResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var membership = await membershipAdministrationService.BlockAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, cancellationToken);
        return Ok(membership);
    }
}
