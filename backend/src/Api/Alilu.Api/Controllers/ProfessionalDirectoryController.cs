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

    /// <summary>
    /// Consulta pública, só-leitura (PROMPT 08, React Native:
    /// TimeSelectionScreen — "verificar disponibilidade"): reaproveita
    /// <see cref="IProfessionalDirectoryService.ValidateAvailableAsync"/>
    /// (a mesma validação usada por <c>BookingsController.Create</c>) só que
    /// devolvendo <c>{ available: false }</c> em vez de lançar, já que aqui
    /// "indisponível" é uma resposta normal, não um erro — o morador ainda
    /// está escolhendo um horário, não enviando a solicitação. Isto não
    /// expõe a agenda do profissional (nenhum horário é devolvido) — só
    /// responde sim/não sobre a janela pedida, mantendo a Etapa 07 (agenda
    /// recorrente/exceções são self-service) intacta. "Nunca confiar no
    /// calendário do React Native" (REGRA CRÍTICA) continua valendo: esta
    /// consulta só melhora a experiência antes do envio — a verificação que
    /// de fato vale é a repetida no servidor dentro de
    /// <see cref="BookingsController.Create"/>.
    /// </summary>
    [HttpGet("{id:guid}/availability-check")]
    public async Task<ActionResult<AvailabilityCheckResponse>> CheckAvailability(
        Guid id,
        [FromQuery] DateOnly date,
        [FromQuery] TimeOnly startTime,
        [FromQuery] TimeOnly endTime,
        CancellationToken cancellationToken)
    {
        try
        {
            await directoryService.ValidateAvailableAsync(id, date, startTime, endTime, cancellationToken);
            return Ok(new AvailabilityCheckResponse(true));
        }
        catch (TimeSlotUnavailableException)
        {
            return Ok(new AvailabilityCheckResponse(false));
        }
    }
}

/// <summary>Resposta de GET .../availability-check.</summary>
public sealed record AvailabilityCheckResponse(bool Available);
