using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do morador (Etapa 23, pedido 1 de
/// Rodrigo: "convidar um prestador, o morador coloca o nome, telefone e
/// email opcional, e a pessoa recebe msg whatsapp e email") — qualquer
/// usuário autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), mesmo padrão de
/// <see cref="RecommendationsController"/>/<see cref="MuralController"/>.
///
/// Ponto de COMPOSIÇÃO para <see cref="Create"/>: o módulo Professional
/// não pode referenciar os módulos Resident/Condominium (PROMPT 01), então
/// é aqui — a Api, composição raiz — que:
///
/// 1. "Morador Active pode convidar" —
///    <see cref="IMembershipService.GetMyActiveMembershipAsync"/> (módulo
///    Resident), que também devolve o <c>CondominiumId</c> do vínculo.
///    Reaproveita o mesmo <see cref="NoActiveMembershipException"/> já
///    usado pelos módulos Scheduling/Recommendations/Mural.
/// 2. O NOME do condomínio (para personalizar o texto do convite) —
///    <see cref="ICondominiumDirectoryService.ListActiveCondominiumsAsync"/>
///    (módulo Condominium; o módulo Professional só recebe o
///    <c>CondominiumId</c>, nunca resolve o nome sozinho — mesmo
///    raciocínio de módulos não se importarem entre si).
/// 3. Só então <see cref="IProfessionalInvitationService.InviteAsync"/>
///    (módulo Professional) — que ainda garante sozinho o limite diário
///    de convites.
/// </summary>
[ApiController]
[Route("api/resident/professional-invitations")]
[Authorize]
public sealed class ProfessionalInvitationsController(
    IProfessionalInvitationService invitationService,
    IMembershipService membershipService,
    ICondominiumDirectoryService condominiumDirectoryService) : ControllerBase
{
    /// <summary>React Native: tela "Convidar prestador" — histórico "convites enviados".</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProfessionalInvitationResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var invitations = await invitationService.ListMyInvitationsAsync(User.GetUserId(), cancellationToken);
        return Ok(invitations);
    }

    /// <summary>React Native: tela "Convidar prestador". Ver o comentário da classe para a sequência completa de composição.</summary>
    [HttpPost]
    public async Task<ActionResult<ProfessionalInvitationResponse>> Create([FromBody] CreateProfessionalInvitationBody body, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var membership = await membershipService.GetMyActiveMembershipAsync(userId, cancellationToken)
            ?? throw new NoActiveMembershipException();

        // "O módulo Professional só recebe o Id, nunca resolve o nome
        // sozinho" — mesmo padrão de find-by-id-a-partir-do-diretório já
        // usado pelo próprio app mobile (ResidentHomeScreen) para exibir o
        // nome do condomínio a partir só do Id do vínculo.
        var condominiums = await condominiumDirectoryService.ListActiveCondominiumsAsync(cancellationToken);
        var condominiumName = condominiums.FirstOrDefault(c => c.Id == membership.CondominiumId)?.Name ?? "seu condomínio";

        var invitation = await invitationService.InviteAsync(
            membership.CondominiumId,
            userId,
            condominiumName,
            body.Name,
            body.Phone,
            body.Email,
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, invitation);
    }
}

/// <summary>Corpo de POST .../professional-invitations.</summary>
public sealed record CreateProfessionalInvitationBody(
    string Name,
    string Phone,
    string? Email);
