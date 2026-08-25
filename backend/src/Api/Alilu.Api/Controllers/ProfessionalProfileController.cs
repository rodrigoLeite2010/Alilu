using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Professional.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do perfil profissional (PROMPT 06) — qualquer
/// usuário autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), nunca a um <c>userId</c> vindo do corpo da
/// requisição (mesmo padrão de <see cref="ResidentMembershipsController"/>).
///
/// Ponto de COMPOSIÇÃO para <see cref="RequestCondominium"/>: valida o
/// condomínio informado no módulo Condominium
/// (<see cref="ICondominiumDirectoryService.ValidateCondominiumAsync"/>)
/// antes de deixar o módulo Professional criar a solicitação — nenhum dos
/// dois módulos poderia fazer isso sozinho (regra do PROMPT 01).
/// </summary>
[ApiController]
[Route("api/professional/profile")]
[Authorize]
public sealed class ProfessionalProfileController(
    IProfessionalProfileService profileService,
    ICondominiumDirectoryService condominiumDirectoryService) : ControllerBase
{
    /// <summary>Meu perfil profissional, se houver. 204 quando o usuário ainda não criou um — o app usa isto para decidir entre o formulário de criação e a edição (React Native: gate de `(professional)/index.tsx`).</summary>
    [HttpGet]
    public async Task<ActionResult<ProfessionalResponse>> GetMine(CancellationToken cancellationToken)
    {
        var profile = await profileService.GetMyProfileAsync(User.GetUserId(), cancellationToken);
        return profile is null ? NoContent() : Ok(profile);
    }

    [HttpPost]
    public async Task<ActionResult<ProfessionalResponse>> Create([FromBody] SaveProfessionalProfileBody body, CancellationToken cancellationToken)
    {
        var profile = await profileService.CreateProfileAsync(
            User.GetUserId(), body.DisplayName, body.Description, body.Phone, body.PhotoUrl, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, profile);
    }

    /// <summary>React Native: ProfessionalEditScreen — "editar perfil".</summary>
    [HttpPut]
    public async Task<ActionResult<ProfessionalResponse>> Update([FromBody] SaveProfessionalProfileBody body, CancellationToken cancellationToken)
    {
        var profile = await profileService.UpdateMyProfileAsync(
            User.GetUserId(), body.DisplayName, body.Description, body.Phone, body.PhotoUrl, cancellationToken);
        return Ok(profile);
    }

    [HttpGet("services")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalServiceResponse>>> ListMyServices(CancellationToken cancellationToken)
    {
        var services = await profileService.ListMyServicesAsync(User.GetUserId(), cancellationToken);
        return Ok(services);
    }

    /// <summary>React Native: ProfessionalEditScreen — "selecionar serviços" (adicionar).</summary>
    [HttpPost("services")]
    public async Task<ActionResult<ProfessionalServiceResponse>> AddMyService([FromBody] AddProfessionalServiceBody body, CancellationToken cancellationToken)
    {
        var service = await profileService.AddMyServiceAsync(
            User.GetUserId(), body.ServiceCategoryId, body.Description, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, service);
    }

    /// <summary>React Native: ProfessionalEditScreen — "selecionar serviços" (remover).</summary>
    [HttpDelete("services/{id:guid}")]
    public async Task<IActionResult> RemoveMyService(Guid id, CancellationToken cancellationToken)
    {
        await profileService.RemoveMyServiceAsync(User.GetUserId(), id, cancellationToken);
        return NoContent();
    }

    [HttpGet("condominiums")]
    public async Task<ActionResult<IReadOnlyList<ProfessionalCondominiumResponse>>> ListMyCondominiums(CancellationToken cancellationToken)
    {
        var condominiums = await profileService.ListMyCondominiumsAsync(User.GetUserId(), cancellationToken);
        return Ok(condominiums);
    }

    /// <summary>React Native: "solicitar atendimento em condomínios".</summary>
    [HttpPost("condominiums")]
    public async Task<ActionResult<ProfessionalCondominiumResponse>> RequestCondominium(
        [FromBody] RequestProfessionalCondominiumBody body,
        CancellationToken cancellationToken)
    {
        await condominiumDirectoryService.ValidateCondominiumAsync(body.CondominiumId, cancellationToken);

        var professionalCondominium = await profileService.RequestCondominiumAsync(
            User.GetUserId(), body.CondominiumId, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, professionalCondominium);
    }
}

/// <summary>Corpo de POST/PUT .../profile — usado tanto para criar quanto para editar (mesmos campos).</summary>
public sealed record SaveProfessionalProfileBody(string DisplayName, string? Description, string? Phone, string? PhotoUrl);

/// <summary>Corpo de POST .../profile/services.</summary>
public sealed record AddProfessionalServiceBody(Guid ServiceCategoryId, string? Description);

/// <summary>Corpo de POST .../profile/condominiums — condomínio escolhido pelo profissional, sempre revalidado no servidor antes de criar a solicitação.</summary>
public sealed record RequestProfessionalCondominiumBody(Guid CondominiumId);
