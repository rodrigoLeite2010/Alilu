using Alilu.Modules.Administration.Application;
using Alilu.Modules.Identity.Application;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de vínculo morador↔condomínio↔unidade
/// (PROMPT 05, FLUXO 2 — estendido na Etapa 12 / PROMPT 12 com
/// "Moradores: listar/visualizar" e "Unidades: visualizar morador
/// vinculado"). Todo o controller exige papel CondominiumAdmin ou
/// SuperAdmin (mesmo padrão de <see cref="CondominiumsController"/>); a
/// Application (<see cref="MembershipAdministrationService"/>) repete essa
/// checagem como segunda camada de defesa.
///
/// Etapa 12 (AUTORIZAÇÃO): todo endpoint resolve primeiro o escopo do
/// usuário autenticado via <see cref="IAdminScopeService"/> — mesmo padrão
/// de <see cref="CondominiumsController"/>.
///
/// Composição com Identity (PROMPT 03): <c>CondominiumMembership</c> só
/// guarda <c>UserId</c>, sem nome/e-mail (módulo Resident não referencia
/// Identity — independência de módulos, PROMPT 01) — por isso os
/// endpoints de leitura aqui compõem com
/// <see cref="IAuthService.GetUsersByIdsAsync"/> (criado especificamente
/// para isso — ver comentário de design lá, "sem nenhuma query N+1") para
/// devolver <see cref="MembershipAdminResponse"/> com nome/e-mail já
/// resolvidos, poupando o admin-web de uma segunda chamada por morador.
/// </summary>
[ApiController]
[Route("api/admin/memberships")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminMembershipsController(
    IMembershipAdministrationService membershipAdministrationService,
    INotificationDispatcher notificationDispatcher,
    IAdminScopeService adminScopeService,
    IAuthService authService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<MembershipAdminResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var pending = await membershipAdministrationService.ListPendingAsync(
            User.GetResidentRequesterRole(), scope.CondominiumId, cancellationToken);
        return Ok(await ComposeWithUserAsync(pending, cancellationToken));
    }

    /// <summary>"Moradores: listar" (PROMPT 12) — todos os vínculos de um condomínio, qualquer status.</summary>
    [HttpGet("condominiums/{condominiumId:guid}")]
    public async Task<ActionResult<IReadOnlyList<MembershipAdminResponse>>> ListByCondominium(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var memberships = await membershipAdministrationService.ListByCondominiumAsync(
            User.GetResidentRequesterRole(), condominiumId, scope.CondominiumId, cancellationToken);
        return Ok(await ComposeWithUserAsync(memberships, cancellationToken));
    }

    /// <summary>"Moradores: visualizar" (PROMPT 12).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MembershipAdminResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var membership = await membershipAdministrationService.GetByIdAsync(
            User.GetResidentRequesterRole(), id, scope.CondominiumId, cancellationToken);
        var composed = await ComposeWithUserAsync([membership], cancellationToken);
        return Ok(composed[0]);
    }

    /// <summary>"Unidades: visualizar morador vinculado" (PROMPT 12) — devolve <c>null</c> (200 com corpo vazio) quando a unidade está vaga, nunca 404.</summary>
    [HttpGet("units/{unitId:guid}/active-membership")]
    public async Task<ActionResult<MembershipAdminResponse?>> GetActiveMembershipByUnit(
        Guid unitId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var membership = await membershipAdministrationService.GetActiveByUnitAsync(
            User.GetResidentRequesterRole(), unitId, scope.CondominiumId, cancellationToken);

        if (membership is null)
        {
            return Ok(null);
        }

        var composed = await ComposeWithUserAsync([membership], cancellationToken);
        return Ok(composed[0]);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<MembershipResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var membership = await membershipAdministrationService.ApproveAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, scope.CondominiumId, cancellationToken);

        // EVENTO "solicitação de acesso aprovada" (PROMPT 11) — para o morador.
        await notificationDispatcher.NotifyAsync(
            membership.UserId,
            NotificationType.AccessRequestApproved,
            "Solicitação de acesso aprovada",
            "Sua solicitação de acesso ao condomínio foi aprovada. Bem-vindo(a)!",
            membership.Id,
            cancellationToken);

        return Ok(membership);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<MembershipResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var membership = await membershipAdministrationService.RejectAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, scope.CondominiumId, cancellationToken);

        // EVENTO "solicitação de acesso rejeitada" (PROMPT 11) — para o morador.
        await notificationDispatcher.NotifyAsync(
            membership.UserId,
            NotificationType.AccessRequestRejected,
            "Solicitação de acesso recusada",
            "Sua solicitação de acesso ao condomínio foi recusada.",
            membership.Id,
            cancellationToken);

        return Ok(membership);
    }

    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<MembershipResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var membership = await membershipAdministrationService.BlockAsync(
            User.GetResidentRequesterRole(), User.GetUserId(), id, scope.CondominiumId, cancellationToken);
        return Ok(membership);
    }

    private Task<AdminScope> ResolveScopeAsync(CancellationToken cancellationToken) =>
        adminScopeService.ResolveScopeAsync(User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);

    /// <summary>
    /// Uma única chamada a <see cref="IAuthService.GetUsersByIdsAsync"/> para
    /// todos os <c>UserId</c> distintos da página inteira — nunca uma
    /// chamada por item (evita N+1). Um Id "desconhecido" (usuário
    /// removido, o que não deveria acontecer, mas o método nunca lança por
    /// isso) resulta em <c>UserName</c>/<c>UserEmail</c> nulos, nunca em erro.
    /// </summary>
    private async Task<IReadOnlyList<MembershipAdminResponse>> ComposeWithUserAsync(
        IReadOnlyList<MembershipResponse> memberships,
        CancellationToken cancellationToken)
    {
        if (memberships.Count == 0)
        {
            return [];
        }

        var userIds = memberships.Select(m => m.UserId).Distinct().ToList();
        var users = await authService.GetUsersByIdsAsync(userIds, cancellationToken);
        var usersById = users.ToDictionary(u => u.Id);

        return memberships
            .Select(m =>
            {
                usersById.TryGetValue(m.UserId, out var user);
                return new MembershipAdminResponse(
                    m.Id,
                    m.UserId,
                    user?.Name,
                    user?.Email,
                    m.CondominiumId,
                    m.UnitId,
                    m.Status,
                    m.ValidatedAt,
                    m.ValidatedBy,
                    m.CreatedAt,
                    m.UpdatedAt);
            })
            .ToList();
    }
}

/// <summary>
/// <see cref="MembershipResponse"/> (módulo Resident) + nome/e-mail do
/// morador, resolvidos via Identity (ver comentário de composição na
/// classe do controller). Vive na Api porque é essa camada — não o módulo
/// Resident — quem tem permissão de conhecer os dois módulos ao mesmo
/// tempo.
/// </summary>
public sealed record MembershipAdminResponse(
    Guid Id,
    Guid UserId,
    string? UserName,
    string? UserEmail,
    Guid CondominiumId,
    Guid UnitId,
    Alilu.Modules.Resident.Domain.MembershipStatus Status,
    DateTime? ValidatedAt,
    Guid? ValidatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt);
