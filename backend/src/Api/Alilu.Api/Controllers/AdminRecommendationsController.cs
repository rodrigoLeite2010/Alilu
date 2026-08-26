using Alilu.Modules.Administration.Application;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Recommendations.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos de moderação de recomendações (PROMPT 10:
/// "Administrador pode moderar") — fila pendente, aprovar, recusar,
/// bloquear. Todo o controller exige papel CondominiumAdmin ou SuperAdmin
/// (mesmo padrão de <see cref="AdminMembershipsController"/>/
/// <see cref="AdminProfessionalCondominiumsController"/>); a Application
/// (<see cref="RecommendationAdministrationService"/>) repete essa checagem
/// como segunda camada de defesa.
///
/// Etapa 12 (AUTORIZAÇÃO): todo endpoint resolve primeiro o escopo do
/// usuário autenticado via <see cref="IAdminScopeService"/> — mesmo padrão
/// de <see cref="CondominiumsController"/>.
/// </summary>
[ApiController]
[Route("api/admin/recommendations")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminRecommendationsController(
    IRecommendationAdministrationService recommendationAdministrationService,
    INotificationDispatcher notificationDispatcher,
    IAdminScopeService adminScopeService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<RecommendationResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var pending = await recommendationAdministrationService.ListPendingAsync(
            User.GetRecommendationRequesterRole(), scope.CondominiumId, cancellationToken);
        return Ok(pending);
    }

    /// <summary>Todas as recomendações (qualquer status) de um condomínio — suporte para "Recomendações: bloquear" (achar uma já Approved) e dashboard, ver comentário de design em <see cref="IRecommendationAdministrationService.ListByCondominiumAsync"/>.</summary>
    [HttpGet("condominiums/{condominiumId:guid}")]
    public async Task<ActionResult<IReadOnlyList<RecommendationResponse>>> ListByCondominium(
        Guid condominiumId,
        CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var recommendations = await recommendationAdministrationService.ListByCondominiumAsync(
            User.GetRecommendationRequesterRole(), condominiumId, scope.CondominiumId, cancellationToken);
        return Ok(recommendations);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<RecommendationResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var recommendation = await recommendationAdministrationService.ApproveAsync(
            User.GetRecommendationRequesterRole(), User.GetUserId(), id, scope.CondominiumId, cancellationToken);

        // EVENTO "recomendação aprovada" (PROMPT 11) — para quem recomendou.
        await notificationDispatcher.NotifyAsync(
            recommendation.RecommendedByUserId,
            NotificationType.RecommendationApproved,
            "Recomendação aprovada",
            "Sua recomendação foi aprovada e já está visível para outros moradores.",
            recommendation.Id,
            cancellationToken);

        return Ok(recommendation);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<RecommendationResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var recommendation = await recommendationAdministrationService.RejectAsync(
            User.GetRecommendationRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(recommendation);
    }

    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<RecommendationResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var scope = await ResolveScopeAsync(cancellationToken);
        var recommendation = await recommendationAdministrationService.BlockAsync(
            User.GetRecommendationRequesterRole(), id, scope.CondominiumId, cancellationToken);
        return Ok(recommendation);
    }

    private Task<AdminScope> ResolveScopeAsync(CancellationToken cancellationToken) =>
        adminScopeService.ResolveScopeAsync(User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);
}
