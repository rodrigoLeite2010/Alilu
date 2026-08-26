using Alilu.Modules.Administration.Application;
using Alilu.Modules.Condominium.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Consulta administrativa de convites (PROMPT 04). Endpoint separado de
/// <see cref="CondominiumsController"/> porque um convite é consultado
/// pelo próprio Id, sem precisar do Id do condomínio na rota.
///
/// Etapa 12 (AUTORIZAÇÃO): resolve o escopo do usuário autenticado via
/// <see cref="IAdminScopeService"/> antes de consultar — mesmo padrão de
/// <see cref="CondominiumsController"/>. Sem isto, um CondominiumAdmin
/// conseguiria consultar o convite de QUALQUER condomínio só sabendo o Id
/// (ele não vem de uma rota aninhada em <c>condominiumId</c>, então a
/// checagem de escopo dentro da Application é a única defesa).
/// </summary>
[ApiController]
[Route("api/admin/invitations")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class CondominiumInvitationsController(
    ICondominiumService condominiumService,
    IAdminScopeService adminScopeService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CondominiumInvitationResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var scope = await adminScopeService.ResolveScopeAsync(
            User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);
        var invitation = await condominiumService.GetInvitationAsync(
            User.GetCondominiumRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(invitation);
    }
}
