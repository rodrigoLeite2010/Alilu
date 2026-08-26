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
/// </summary>
[ApiController]
[Route("api/admin/recommendations")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminRecommendationsController(IRecommendationAdministrationService recommendationAdministrationService) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<ActionResult<IReadOnlyList<RecommendationResponse>>> ListPending(CancellationToken cancellationToken)
    {
        var pending = await recommendationAdministrationService.ListPendingAsync(
            User.GetRecommendationRequesterRole(), cancellationToken);
        return Ok(pending);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<RecommendationResponse>> Approve(Guid id, CancellationToken cancellationToken)
    {
        var recommendation = await recommendationAdministrationService.ApproveAsync(
            User.GetRecommendationRequesterRole(), User.GetUserId(), id, cancellationToken);
        return Ok(recommendation);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<RecommendationResponse>> Reject(Guid id, CancellationToken cancellationToken)
    {
        var recommendation = await recommendationAdministrationService.RejectAsync(
            User.GetRecommendationRequesterRole(), id, cancellationToken);
        return Ok(recommendation);
    }

    [HttpPost("{id:guid}/block")]
    public async Task<ActionResult<RecommendationResponse>> Block(Guid id, CancellationToken cancellationToken)
    {
        var recommendation = await recommendationAdministrationService.BlockAsync(
            User.GetRecommendationRequesterRole(), id, cancellationToken);
        return Ok(recommendation);
    }
}
