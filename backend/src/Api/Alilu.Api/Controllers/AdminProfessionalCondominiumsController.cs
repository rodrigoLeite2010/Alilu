using Alilu.Modules.Administration.Application;
using Alilu.Modules.Professional.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de vínculo profissional↔condomínio (PROMPT
/// 06, estendido na Etapa 12 / PROMPT 12 com "listar", "associar" e
/// "bloquear") — decisão sobre solicitações de atendimento pendentes
/// (React Native, profissional: "solicitar atendimento em condomínios";
/// alguém precisa fechar esse fluxo, mesmo raciocínio de
/// <see cref="AdminMembershipsController"/> para o FLUXO 2 do módulo
/// Resident). Todo o controller exige papel CondominiumAdmin ou
/// SuperAdmin; a Application (<see cref="ProfessionalAdministrationService"/>)
/// repete essa checagem como segunda camada de defesa.
///
/// Etapa 12 (AUTORIZAÇÃO): todo endpoint resolve primeiro o escopo do
/// usuário autenticado via <see cref="IAdminScopeService"/> — mesmo padrão
/// de <see cref="CondominiumsController"/>.
/// </summary>
[ApiController]
[Route("api/admin/professional-condominiums")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminProfessionalCondominiumsController(
    IProfessionalAdministrationService administrationService,
    IAdminScopeService adminScopeService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalCondominiumResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var pending = await administrationService.ListPendingCondominiumRequestsAsync(
            User.GetProfessionalRequesterRole(), scope.CondominiumId, cancellationToken);
        return Ok(pending);
    }

    /// <summary>"Profissionais: visualizar histórico" (PROMPT 12) parte da listagem — devolve todos os vínculos (qualquer status) do condomínio; o histórico de agendamentos vem de <c>ProfessionalBookingsController</c>/<c>Scheduling.IBookingService.ListBookingsByCondominiumIdAsync</c>, composto separadamente pelo admin-web.</summary>
    [HttpGet("condominiums/{condominiumId:guid}")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalCondominiumResponse>>> ListByCondominium(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var professionalCondominiums = await administrationService.ListByCondominiumAsync(
            User.GetProfessionalRequesterRole(), condominiumId, scope.CondominiumId, cancellationToken);
        return Ok(professionalCondominiums);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var professionalCondominium = await administrationService.ApproveCondominiumAsync(
            User.GetProfessionalRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(professionalCondominium);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var professionalCondominium = await administrationService.RejectCondominiumAsync(
            User.GetProfessionalRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(professionalCondominium);
    }

    /// <summary>"Profissionais: bloquear" (PROMPT 12) — desativa o vínculo com ESTE condomínio, não o perfil global do profissional (ver comentário de design em <see cref="IProfessionalAdministrationService.BlockAsync"/>).</summary>
    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var professionalCondominium = await administrationService.BlockAsync(
            User.GetProfessionalRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(professionalCondominium);
    }

    /// <summary>"Profissionais: associar ao condomínio" (PROMPT 12) — cadastro direto pelo administrador, sem solicitação prévia do profissional.</summary>
    [HttpPost("associate")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> Associate(
        [FromBody] AssociateProfessionalBody body,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var professionalCondominium = await administrationService.AssociateAsync(
            User.GetProfessionalRequesterRole(), body.ProfessionalId, body.CondominiumId, scope.CondominiumId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, professionalCondominium);
    }

    private Task<AdminScope> ResolveScopeAsync(CancellationToken cancellationToken) =>
        adminScopeService.ResolveScopeAsync(User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);
}

/// <summary>Corpo de POST .../associate (PROMPT 12).</summary>
public sealed record AssociateProfessionalBody(Guid ProfessionalId, Guid CondominiumId);
