using Alilu.Modules.Professional.Application;
using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Reviews.Application;
using Alilu.Modules.Scheduling.Application;
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
    IRecommendationDirectoryService recommendationDirectoryService,
    IBookingService bookingService) : ControllerBase
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
    /// Consulta pública, só-leitura (React Native: DateSelectionScreen/
    /// TimeSelectionScreen — "só aceitar a hora que o profissional deixou
    /// livre"). Substitui o antigo <c>GET .../availability-check</c> da
    /// Etapa 08 (que só respondia sim/não para um horário digitado pelo
    /// morador, numa tentativa atrás da outra) — decisão revertida a
    /// pedido explícito, depois de testar o fluxo ponta a ponta: ver
    /// <see cref="IProfessionalDirectoryService.ListOpenWindowsAsync"/>
    /// para o histórico completo da mudança.
    ///
    /// Ponto de COMPOSIÇÃO: nenhum dos dois módulos envolvidos pode
    /// referenciar o outro (PROMPT 01) — as janelas "abertas" vêm do
    /// módulo Professional (agenda recorrente + exceções da Etapa 07,
    /// <see cref="IProfessionalDirectoryService.ListOpenWindowsAsync"/>);
    /// as janelas já ocupadas vêm do módulo Scheduling
    /// (<see cref="IBookingService.ListBookedWindowsAsync"/>). Só aqui, na
    /// Api, os dois se cruzam (subtrai ocupado de aberto) para devolver as
    /// janelas realmente livres. "Nunca confiar no calendário do React
    /// Native" (REGRA CRÍTICA da Etapa 08) continua valendo:
    /// <see cref="BookingsController.Create"/> revalida tudo de novo no
    /// servidor antes de criar o agendamento — esta consulta só melhora a
    /// experiência antes do envio.
    /// </summary>
    [HttpGet("{id:guid}/availability-windows")]
    public async Task<ActionResult<IReadOnlyList<AvailableTimeWindowResponse>>> ListAvailabilityWindows(
        Guid id,
        [FromQuery] DateOnly date,
        CancellationToken cancellationToken)
    {
        var openWindows = await directoryService.ListOpenWindowsAsync(id, date, cancellationToken);
        var bookedWindows = await bookingService.ListBookedWindowsAsync(id, date, cancellationToken);

        var freeWindows = SubtractBusyWindows(
            openWindows.Select(window => (window.StartTime, window.EndTime)),
            bookedWindows.Select(window => (window.StartTime, window.EndTime)));

        return Ok(freeWindows.Select(window => new AvailableTimeWindowResponse(window.Start, window.End)).ToList());
    }

    /// <summary>
    /// React Native: DateSelectionScreen — "a experiência do calendário está
    /// confusa, tinha que só deixar escolher a data que tem disponibilidade"
    /// (pedido explícito depois de testar o fluxo). Devolve, dentro de
    /// <paramref name="from"/>/<paramref name="to"/> (inclusive), só as
    /// datas em que o profissional tem pelo menos uma janela livre — a tela
    /// usa isso para desabilitar (ficar "cinza") os dias sem disponibilidade
    /// na grade do mês, além dos dias passados que ela já desabilitava.
    ///
    /// Reaproveita a mesma composição de <see cref="ListAvailabilityWindows"/>
    /// (janelas abertas do módulo Professional menos as ocupadas do módulo
    /// Scheduling), uma data por vez — "nunca confiar no calendário do React
    /// Native" continua valendo: quem de fato impede um agendamento inválido
    /// é a Api dentro de <see cref="BookingsController.Create"/>, isto aqui
    /// só melhora a experiência antes de chegar lá.
    ///
    /// As consultas são sequenciais (não em paralelo) de propósito: as duas
    /// dependem do mesmo <c>DbContext</c> por requisição (raiz da Api), que
    /// não é thread-safe — rodar em paralelo lançaria
    /// "A second operation was started on this context before a previous
    /// operation completed." Por isso também há um limite de 62 dias no
    /// intervalo (cerca de dois meses), para não deixar a requisição lenta
    /// demais nem virar um jeito de sobrecarregar a Api.
    /// </summary>
    [HttpGet("{id:guid}/available-dates")]
    public async Task<ActionResult<IReadOnlyList<DateOnly>>> ListAvailableDates(
        Guid id,
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken cancellationToken)
    {
        if (to < from)
        {
            return BadRequest(new { title = "A data final precisa ser igual ou depois da data inicial." });
        }

        if (to.DayNumber - from.DayNumber > 62)
        {
            return BadRequest(new { title = "Intervalo muito longo — no máximo 62 dias." });
        }

        var availableDates = new List<DateOnly>();

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var openWindows = await directoryService.ListOpenWindowsAsync(id, date, cancellationToken);
            if (openWindows.Count == 0)
            {
                continue;
            }

            var bookedWindows = await bookingService.ListBookedWindowsAsync(id, date, cancellationToken);
            var freeWindows = SubtractBusyWindows(
                openWindows.Select(window => (window.StartTime, window.EndTime)),
                bookedWindows.Select(window => (window.StartTime, window.EndTime)));

            if (freeWindows.Count > 0)
            {
                availableDates.Add(date);
            }
        }

        return Ok(availableDates);
    }

    /// <summary>Mesma lógica de subtração de intervalos usada em <c>ProfessionalDirectoryService.ListOpenWindowsAsync</c> (Professional, para exceções) — duplicada aqui de propósito: esta versão cruza dados de dois módulos diferentes (Professional + Scheduling), então só pode viver na Api (composição raiz), nunca dentro de um dos módulos.</summary>
    private static IReadOnlyList<(TimeOnly Start, TimeOnly End)> SubtractBusyWindows(
        IEnumerable<(TimeOnly StartTime, TimeOnly EndTime)> openWindows,
        IEnumerable<(TimeOnly StartTime, TimeOnly EndTime)> busyWindows)
    {
        var windows = openWindows.Select(window => (Start: window.StartTime, End: window.EndTime)).ToList();

        foreach (var (busyStart, busyEnd) in busyWindows)
        {
            var remaining = new List<(TimeOnly Start, TimeOnly End)>();

            foreach (var (start, end) in windows)
            {
                if (busyEnd <= start || busyStart >= end)
                {
                    remaining.Add((start, end));
                    continue;
                }

                if (busyStart > start)
                {
                    remaining.Add((start, busyStart));
                }

                if (busyEnd < end)
                {
                    remaining.Add((busyEnd, end));
                }
            }

            windows = remaining;
        }

        return windows.OrderBy(window => window.Start).ToList();
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

/// <summary>Resposta de GET .../availability-windows — uma janela livre, já com os horários já reservados descontados (ver comentário do método na controller).</summary>
public sealed record AvailableTimeWindowResponse(TimeOnly StartTime, TimeOnly EndTime);

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
