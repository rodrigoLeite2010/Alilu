using Alilu.Modules.Professional.Application;
using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do morador (PROMPT 10) — qualquer
/// usuário autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), mesmo padrão de <see cref="ReviewsController"/>.
///
/// Ponto de COMPOSIÇÃO para <see cref="Create"/>: o módulo Recommendations
/// não pode referenciar os módulos Resident/Professional (PROMPT 01), então
/// é aqui — a Api, composição raiz — que as REGRAS CRÍTICAS do prompt que
/// cruzam módulos são aplicadas ANTES de deixar o módulo Recommendations
/// gravar a indicação:
///
/// 1. "Morador Active pode recomendar" —
///    <see cref="IMembershipService.GetMyActiveMembershipAsync"/> (módulo
///    Resident), que também devolve o <c>CondominiumId</c> do vínculo — o
///    módulo Recommendations não tem como descobri-lo sozinho. Reaproveita
///    o mesmo <see cref="NoActiveMembershipException"/> já usado pelo
///    módulo Scheduling (Etapa 08) — a mensagem menciona "unidade", um
///    pouco mais específica do que o necessário aqui, mas descreve a
///    mesma causa raiz (sem vínculo Active).
/// 2. "Se o profissional já existir no ALILU, vincular ProfessionalId" —
///    quando <c>body.ProfessionalId</c> é informado, valida com
///    <see cref="IProfessionalDirectoryService.GetProfessionalProfileAsync"/>
///    (módulo Professional, só profissionais Active) antes de repassar.
/// 3. Só então <see cref="IRecommendationService.RecommendAsync"/> (módulo
///    Recommendations) — que ainda garante sozinho "não permitir spam
///    ilimitado".
/// </summary>
[ApiController]
[Route("api/resident/recommendations")]
[Authorize]
public sealed class RecommendationsController(
    IRecommendationService recommendationService,
    IMembershipService membershipService,
    IProfessionalDirectoryService professionalDirectoryService) : ControllerBase
{
    /// <summary>React Native: RecommendationsScreen — "minhas recomendações".</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecommendationResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var recommendations = await recommendationService.ListMyRecommendationsAsync(User.GetUserId(), cancellationToken);
        return Ok(recommendations);
    }

    /// <summary>React Native: RecommendationDetailsScreen.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RecommendationResponse>> GetMine(Guid id, CancellationToken cancellationToken)
    {
        var recommendation = await recommendationService.GetMyRecommendationAsync(User.GetUserId(), id, cancellationToken);
        return Ok(recommendation);
    }

    /// <summary>
    /// React Native: RecommendProfessionalScreen — "recomendar
    /// profissional". Ver o comentário da classe para a sequência completa
    /// de composição/validação.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<RecommendationResponse>> Create([FromBody] CreateRecommendationBody body, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var membership = await membershipService.GetMyActiveMembershipAsync(userId, cancellationToken)
            ?? throw new NoActiveMembershipException();

        if (body.ProfessionalId is { } professionalId)
        {
            _ = await professionalDirectoryService.GetProfessionalProfileAsync(professionalId, cancellationToken)
                ?? throw new ProfessionalNotFoundException();
        }

        var recommendation = await recommendationService.RecommendAsync(
            membership.CondominiumId,
            userId,
            body.ProfessionalId,
            body.ExternalProfessionalName,
            body.ExternalPhone,
            body.ServiceCategoryId,
            body.Comment,
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, recommendation);
    }
}

/// <summary>
/// Corpo de POST .../recommendations. Exatamente um entre
/// <see cref="ProfessionalId"/> e <see cref="ExternalProfessionalName"/>
/// deve ser informado — o Domain (<c>Recommendation.Recommend</c>) valida
/// essa regra.
/// </summary>
public sealed record CreateRecommendationBody(
    Guid? ProfessionalId,
    string? ExternalProfessionalName,
    string? ExternalPhone,
    Guid ServiceCategoryId,
    string Comment);
