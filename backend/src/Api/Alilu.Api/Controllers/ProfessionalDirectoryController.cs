using Alilu.Modules.Professional.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Diretório público de profissionais/categorias (PROMPT 06) — qualquer
/// usuário autenticado pode consultar; usado pelo morador para
/// listar/filtrar/visualizar perfis (React Native: ProfessionalListScreen/
/// ServiceCategoryScreen/ProfessionalProfileScreen).
/// </summary>
[ApiController]
[Route("api/directory/professionals")]
[Authorize]
public sealed class ProfessionalDirectoryController(IProfessionalDirectoryService directoryService) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<ActionResult<IReadOnlyList<ServiceCategoryResponse>>> ListCategories(CancellationToken cancellationToken)
    {
        var categories = await directoryService.ListCategoriesAsync(cancellationToken);
        return Ok(categories);
    }

    /// <summary>React Native: "listar profissionais; filtrar categoria" — <paramref name="categoryId"/> é opcional.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProfessionalDirectoryItemResponse>>> ListProfessionals(
        [FromQuery] Guid? categoryId,
        CancellationToken cancellationToken)
    {
        var professionals = await directoryService.ListProfessionalsAsync(categoryId, cancellationToken);
        return Ok(professionals);
    }

    /// <summary>React Native: "visualizar perfil". 404 quando o perfil não existe ou não está mais ativo.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProfessionalDirectoryItemResponse>> GetProfile(Guid id, CancellationToken cancellationToken)
    {
        var profile = await directoryService.GetProfessionalProfileAsync(id, cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }
}
