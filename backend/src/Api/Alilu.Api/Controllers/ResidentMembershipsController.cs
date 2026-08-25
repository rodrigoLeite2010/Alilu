using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service de validação do morador (PROMPT 05) — qualquer
/// usuário autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), nunca a um <c>userId</c> vindo do corpo da
/// requisição.
///
/// Este é o ponto de COMPOSIÇÃO (a Api é a "composição raiz" — nenhum
/// módulo referencia outro, ver ARCHITECTURE.md): os dois primeiros
/// endpoints abaixo orquestram o módulo Condominium (validar convite /
/// validar unidade) e o módulo Resident (criar o vínculo) em sequência,
/// porque nenhum dos dois módulos poderia fazer isso sozinho.
/// </summary>
[ApiController]
[Route("api/resident/memberships")]
[Authorize]
public sealed class ResidentMembershipsController(
    IMembershipService membershipService,
    IInvitationRedemptionService invitationRedemptionService,
    ICondominiumDirectoryService condominiumDirectoryService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MembershipResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var memberships = await membershipService.ListMyMembershipsAsync(User.GetUserId(), cancellationToken);
        return Ok(memberships);
    }

    /// <summary>
    /// Vínculo Active do usuário, se houver — o app usa isto para decidir
    /// entre mostrar a área do morador (ResidentHome) ou o fluxo de
    /// validação (ChooseCondominium/EnterInvitationCode/WaitingApproval).
    /// 204 quando não há nenhum vínculo Active (nem Pending) — "acesso sem
    /// vínculo" (PROMPT 05).
    /// </summary>
    [HttpGet("active")]
    public async Task<ActionResult<MembershipResponse>> GetActive(CancellationToken cancellationToken)
    {
        var membership = await membershipService.GetMyActiveMembershipAsync(User.GetUserId(), cancellationToken);
        return membership is null ? NoContent() : Ok(membership);
    }

    /// <summary>
    /// FLUXO 1 (convite). Passos 1-9 do PROMPT 05: valida o convite
    /// (módulo Condominium — código, validade, uso, e-mail, identifica
    /// condomínio/unidade), cria o vínculo já Active (módulo Resident) e,
    /// só depois de confirmado, marca o convite como usado — padrão de
    /// duas fases (ver <see cref="IInvitationRedemptionService"/>): se a
    /// criação do vínculo falhar (ex.: <see cref="DuplicateMembershipException"/>),
    /// o convite continua válido e a pessoa pode tentar de novo.
    /// </summary>
    [HttpPost("redeem-invitation")]
    public async Task<ActionResult<MembershipResponse>> RedeemInvitation(
        [FromBody] RedeemInvitationBody body,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        // 1-6: validar o código/validade/uso/e-mail e identificar
        // condomínio/unidade — sempre a partir do PRÓPRIO convite, nunca
        // de nada que o corpo da requisição informe (o corpo só tem o
        // código digitado, ver RedeemInvitationBody).
        var validation = await invitationRedemptionService.ValidateInvitationAsync(body.Code, body.Email, cancellationToken);

        // 7: criar o Membership (nasce Active).
        var membership = await membershipService.CreateMembershipFromInvitationAsync(
            userId, validation.CondominiumId, validation.UnitId, cancellationToken);

        // 8: só agora, com o vínculo já persistido com sucesso, marcar o
        // convite como utilizado.
        await invitationRedemptionService.MarkInvitationAsUsedAsync(validation.InvitationId, cancellationToken);

        // 9: ativar o vínculo — já nasceu Active neste fluxo, nada mais a fazer.
        return StatusCode(StatusCodes.Status201Created, membership);
    }

    /// <summary>
    /// FLUXO 2 ("Não encontrei minha unidade"). Confirma que a unidade
    /// informada existe e pertence ao condomínio informado (módulo
    /// Condominium — nunca confia cegamente no que o cliente mandou) e
    /// então cria a solicitação (módulo Resident), que nasce Pending.
    /// </summary>
    [HttpPost("request-access")]
    public async Task<ActionResult<MembershipResponse>> RequestAccess(
        [FromBody] RequestResidentAccessBody body,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        await condominiumDirectoryService.ValidateUnitAsync(body.CondominiumId, body.UnitId, cancellationToken);

        var membership = await membershipService.RequestResidentAccessAsync(
            userId, body.CondominiumId, body.UnitId, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, membership);
    }
}

/// <summary>Corpo de POST .../redeem-invitation — <see cref="Email"/> é opcional (checagem "quando aplicável", ver PROMPT 05); o app envia o e-mail do próprio usuário autenticado.</summary>
public sealed record RedeemInvitationBody(string Code, string? Email);

/// <summary>Corpo de POST .../request-access — condomínio/unidade escolhidos pelo usuário no diretório público (ver <see cref="CondominiumDirectoryController"/>), sempre revalidados no servidor antes de criar a solicitação.</summary>
public sealed record RequestResidentAccessBody(Guid CondominiumId, Guid UnitId);
