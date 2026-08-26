using Alilu.Modules.Professional.Application;
using Alilu.Modules.Reviews.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do profissional (PROMPT 09: "visualizar
/// avaliações recebidas; visualizar média").
///
/// Ponto de COMPOSIÇÃO (mesmo padrão de <see cref="ProfessionalBookingsController"/>):
/// as avaliações guardam o <c>Professional.Id</c> (perfil, módulo
/// Professional), não o <c>User.Id</c> de quem está autenticado — como o
/// módulo Reviews não pode referenciar o módulo Professional para resolver
/// esse Id sozinho, é aqui que a Api resolve o próprio perfil do usuário
/// autenticado (<see cref="IProfessionalProfileService.GetMyProfileAsync"/>)
/// antes de repassar o <c>professionalId</c> já resolvido para
/// <see cref="IProfessionalReviewService"/>.
/// </summary>
[ApiController]
[Route("api/professional/reviews")]
[Authorize]
public sealed class ProfessionalReviewsController(
    IProfessionalReviewService professionalReviewService,
    IProfessionalProfileService profileService) : ControllerBase
{
    /// <summary>React Native: ProfessionalReviewsScreen — "visualizar avaliações recebidas".</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReviewResponse>>> ListReceived(CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var reviews = await professionalReviewService.ListReceivedAsync(professionalId, cancellationToken);
        return Ok(reviews);
    }

    /// <summary>React Native: ProfessionalReviewsScreen/RatingSummary — "visualizar média".</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<ProfessionalRatingSummaryResponse>> GetSummary(CancellationToken cancellationToken)
    {
        var professionalId = await ResolveMyProfessionalIdAsync(cancellationToken);
        var summary = await professionalReviewService.GetRatingSummaryAsync(professionalId, cancellationToken);
        return Ok(summary);
    }

    private async Task<Guid> ResolveMyProfessionalIdAsync(CancellationToken cancellationToken)
    {
        var profile = await profileService.GetMyProfileAsync(User.GetUserId(), cancellationToken)
            ?? throw new ProfessionalNotFoundException();

        return profile.Id;
    }
}
