using Alilu.Modules.Mural.Application;
using Alilu.Modules.Resident.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do morador (Etapa 23, pedido 3: "Mural,
/// onde e texto aberto por morador") — qualquer usuário autenticado pode
/// chamar, sempre restrito ao próprio usuário (<c>User.GetUserId()</c>),
/// mesmo padrão de <see cref="RecommendationsController"/>.
///
/// Ponto de COMPOSIÇÃO para <see cref="Create"/>: o módulo Mural não pode
/// referenciar o módulo Resident (PROMPT 01), então é aqui — a Api,
/// composição raiz — que a REGRA CRÍTICA "morador Active pode publicar" é
/// aplicada ANTES de deixar o módulo Mural gravar o post, usando
/// <see cref="IMembershipService.GetMyActiveMembershipAsync"/> (módulo
/// Resident), que também devolve o <c>CondominiumId</c> do vínculo — o
/// módulo Mural não tem como descobri-lo sozinho. Reaproveita o mesmo
/// <see cref="NoActiveMembershipException"/> já usado pelos módulos
/// Scheduling (Etapa 08) e Recommendations (Etapa 10).
/// </summary>
[ApiController]
[Route("api/resident/mural")]
[Authorize]
public sealed class MuralController(
    IMuralService muralService,
    IMembershipService membershipService) : ControllerBase
{
    /// <summary>React Native: MuralScreen — feed do condomínio do morador autenticado.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<MuralPostResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var membership = await membershipService.GetMyActiveMembershipAsync(userId, cancellationToken)
            ?? throw new NoActiveMembershipException();

        var posts = await muralService.ListForResidentFeedAsync(membership.CondominiumId, userId, cancellationToken);
        return Ok(posts);
    }

    /// <summary>React Native: tela "Novo post" do Mural. Ver o comentário da classe para a sequência completa de composição/validação.</summary>
    [HttpPost]
    public async Task<ActionResult<MuralPostResponse>> Create([FromBody] CreateMuralPostBody body, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var membership = await membershipService.GetMyActiveMembershipAsync(userId, cancellationToken)
            ?? throw new NoActiveMembershipException();

        var post = await muralService.CreateAsync(
            membership.CondominiumId,
            userId,
            body.Type,
            body.Content,
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, post);
    }
}

/// <summary>Corpo de POST .../mural.</summary>
public sealed record CreateMuralPostBody(
    Alilu.Modules.Mural.Domain.MuralPostType Type,
    string Content);
