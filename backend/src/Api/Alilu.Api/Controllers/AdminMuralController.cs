using Alilu.Modules.Administration.Application;
using Alilu.Modules.Mural.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de moderação do Mural (Etapa 23, decisão de
/// Rodrigo: pós-moderação — post nasce visível, síndico/admin pode
/// bloquear depois). Todo o controller exige papel CondominiumAdmin ou
/// SuperAdmin (mesmo padrão de <see cref="AdminRecommendationsController"/>);
/// a Application (<see cref="MuralAdministrationService"/>) repete essa
/// checagem como segunda camada de defesa.
///
/// Todo endpoint resolve primeiro o escopo do usuário autenticado via
/// <see cref="IAdminScopeService"/> — mesmo padrão de
/// <see cref="AdminRecommendationsController"/> (Etapa 12).
/// </summary>
[ApiController]
[Route("api/admin/mural")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminMuralController(
    IMuralAdministrationService muralAdministrationService,
    IAdminScopeService adminScopeService) : ControllerBase
{
    /// <summary>admin-web: página Mural — todos os posts (qualquer status) de um condomínio.</summary>
    [HttpGet("condominiums/{condominiumId:guid}")]
    public async Task<ActionResult<IReadOnlyList<MuralPostResponse>>> ListByCondominium(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var posts = await muralAdministrationService.ListByCondominiumAsync(
            User.GetMuralRequesterRole(), condominiumId, scope.CondominiumId, cancellationToken);
        return Ok(posts);
    }

    /// <summary>admin-web: botão "Bloquear".</summary>
    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<MuralPostResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var post = await muralAdministrationService.BlockAsync(
            User.GetMuralRequesterRole(), User.GetUserId(), id, scope.CondominiumId, cancellationToken);
        return Ok(post);
    }

    private Task<AdminScope> ResolveScopeAsync(CancellationToken cancellationToken) =>
        adminScopeService.ResolveScopeAsync(User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);
}
