using Alilu.Modules.Condominium.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Consulta administrativa de convites (PROMPT 04). Endpoint separado de
/// <see cref="CondominiumsController"/> porque um convite é consultado
/// pelo próprio Id, sem precisar do Id do condomínio na rota.
/// </summary>
[ApiController]
[Route("api/admin/invitations")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class CondominiumInvitationsController(ICondominiumService condominiumService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CondominiumInvitationResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var invitation = await condominiumService.GetInvitationAsync(
            User.GetCondominiumRequesterRole(), id, cancellationToken);
        return Ok(invitation);
    }
}
