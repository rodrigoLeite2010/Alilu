using Alilu.Modules.Professional.Application;
using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Reviews.Application;
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
public sealed class ProfessionalDirectoryController(
    IProfessionalDirectoryService directoryService,
    IProfessionalReviewService professionalReviewService,
    IRecommendationDirectoryService recommendationDirectoryService) : ControllerBase
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

    /// <summary>
    /// Consulta pública, só-leitura (PROMPT 10, React Native:
    /// ProfessionalRecommendationsScreen — "Carlos Elétrica ⭐ 4.9
    /// Recomendado por 7 moradores"). Ponto de COMPOSIÇÃO: o módulo
    /// Recommendations não pode referenciar os módulos Professional/Reviews
    /// (PROMPT 01), então é aqui que o nome (Professional), a nota média
    /// (Reviews) e a contagem/lista de indicações aprovadas
    /// (Recommendations) são combinados numa única resposta. Sem distinção
    /// de papel — tanto o morador (avaliando quem contratar) quanto o
    /// próprio profissional (vendo o seu perfil) podem chamar.
    ///
    /// De propósito NÃO inclui "✓ Já prestou serviço no condomínio" (linha
    /// do objetivo de UX do prompt) — exigiria uma nova consulta no módulo
    /// Scheduling, fora do escopo de uma etapa "SOMENTE Recommendations";
    /// ver ARCHITECTURE.md, "Etapa 10", para a decisão completa.
    /// </summary>
    [HttpGet("{id:guid}/recommendations")]
    public async Task<ActionResult<ProfessionalRecommendationProfileResponse>> GetRecommendationProfile(Guid id, CancellationToken cancellationToken)
    {
        var profile = await directoryService.GetProfessionalProfileAsync(id, cancellationToken);
        if (profile is null)
        {
            return NotFound();
        }

        var ratingSummary = await professionalReviewService.GetRatingSummaryAsync(id, cancellationToken);
        var recommendationSummary = await recommendationDirectoryService.GetSummaryByProfessionalIdAsync(id, cancellationToken);
        var recommendations = await recommendationDirectoryService.ListApprovedByProfessionalIdAsync(id, cancellationToken);

        return Ok(new ProfessionalRecommendationProfileResponse(
            id,
            profile.DisplayName,
            ratingSummary.AverageRating,
            ratingSummary.TotalReviews,
            recommendationSummary.TotalApproved,
            recommendations));
    }
}

/// <summary>Resposta de GET .../availability-check.</summary>
public sealed record AvailabilityCheckResponse(bool Available);

/// <summary>
/// Resposta de GET .../recommendations — composta na Api a partir de três
/// módulos (Professional, Reviews, Recommendations). React Native:
/// ProfessionalRecommendationsScreen.
/// </summary>
public sealed record ProfessionalRecommendationProfileResponse(
    Guid ProfessionalId,
    string ProfessionalName,
    double AverageRating,
    int TotalReviews,
    int TotalRecommendations,
    IReadOnlyList<RecommendationResponse> Recommendations);
