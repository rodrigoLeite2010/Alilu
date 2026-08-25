using Alilu.Modules.Professional.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de vínculo profissional↔condomínio (PROMPT
/// 06) — decisão sobre solicitações de atendimento pendentes (React
/// Native, profissional: "solicitar atendimento em condomínios"; alguém
/// precisa fechar esse fluxo, mesmo raciocínio de
/// <see cref="AdminMembershipsController"/> para o FLUXO 2 do módulo
/// Resident). Todo o controller exige papel CondominiumAdmin ou
/// SuperAdmin; a Application (<see cref="ProfessionalAdministrationService"/>)
/// repete essa checagem como segunda camada de defesa.
/// </summary>
[ApiController]
[Route("api/admin/professional-condominiums")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminProfessionalCondominiumsController(IProfessionalAdministrationService administrationService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalCondominiumResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var pending = await administrationService.ListPendingCondominiumRequestsAsync(
            User.GetProfessionalRequesterRole(), cancellationToken);
        return Ok(pending);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var professionalCondominium = await administrationService.ApproveCondominiumAsync(
            User.GetProfessionalRequesterRole(), id, cancellationToken);
        return Ok(professionalCondominium);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var professionalCondominium = await administrationService.RejectCondominiumAsync(
            User.GetProfessionalRequesterRole(), id, cancellationToken);
        return Ok(professionalCondominium);
    }
}
