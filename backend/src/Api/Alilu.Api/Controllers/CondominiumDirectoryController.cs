using Alilu.Modules.Condominium.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Diretório público de condomínios/unidades (PROMPT 05, FLUXO 2 — "Não
/// encontrei minha unidade") — qualquer usuário autenticado pode
/// consultar, para escolher condomínio/unidade nas telas ChooseCondominium/
/// RequestResidentAccess (mobile) antes de enviar uma solicitação de
/// vínculo (ver <see cref="ResidentMembershipsController.RequestAccess"/>,
/// que revalida a escolha no servidor).
/// </summary>
[ApiController]
[Route("api/directory")]
[Authorize]
public sealed class CondominiumDirectoryController(ICondominiumDirectoryService condominiumDirectoryService) : ControllerBase
{
    [HttpGet("condominiums")]
    public async Task<ActionResult<IReadOnlyList<CondominiumSummaryResponse>>> ListCondominiums(CancellationToken cancellationToken)
    {
        var condominiums = await condominiumDirectoryService.ListActiveCondominiumsAsync(cancellationToken);
        return Ok(condominiums);
    }

    [HttpGet("condominiums/{condominiumId:guid}/units")]
    public async Task<ActionResult<IReadOnlyList<CondominiumUnitSummaryResponse>>> ListUnits(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var units = await condominiumDirectoryService.ListActiveUnitsAsync(condominiumId, cancellationToken);
        return Ok(units);
    }
}
