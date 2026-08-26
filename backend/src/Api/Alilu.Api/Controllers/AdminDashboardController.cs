using Alilu.Modules.Administration.Application;
using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Resident.Application;
using Alilu.Modules.Resident.Domain;
using Alilu.Modules.Scheduling.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// "Dashboard" (PROMPT 12) — os seis números pedidos (moradores, unidades,
/// profissionais, agendamentos, solicitações pendentes, recomendações
/// pendentes) de UM condomínio, compostos aqui na Api a partir dos cinco
/// módulos de negócio (nenhum deles referencia o outro — independência de
/// módulos, PROMPT 01). Mesmo papel de composição de
/// <c>BookingsController</c>/<c>AdminMembershipsController</c> nas etapas
/// anteriores.
///
/// Decisões de escopo/contagem, documentadas por não estarem explícitas no
/// prompt:
/// <list type="bullet">
/// <item>"moradores" conta vínculos <see cref="MembershipStatus.Active"/> —
/// gente de fato morando, não solicitações pendentes/rejeitadas/bloqueadas.</item>
/// <item>"unidades" conta todas as unidades cadastradas, qualquer status
/// (inclui bloqueadas — "quantas unidades este condomínio tem" é uma
/// pergunta sobre o cadastro, não sobre disponibilidade).</item>
/// <item>"profissionais" conta vínculos profissional↔condomínio
/// <see cref="ProfessionalCondominiumStatus.Active"/> — quem de fato atende
/// este condomínio hoje.</item>
/// <item>"agendamentos" conta todos os agendamentos já criados para este
/// condomínio, qualquer status (histórico completo, não só os futuros).</item>
/// <item>"solicitações pendentes" soma as duas filas de decisão do
/// administrador que já existiam antes desta etapa: pedidos de acesso de
/// morador (FLUXO 2) e pedidos de atendimento de profissional — ambos são,
/// literalmente, "solicitações" aguardando o mesmo administrador.</item>
/// <item>"recomendações pendentes" é só a fila de moderação do módulo
/// Recommendations — já é um item próprio no prompt, sem ambiguidade.</item>
/// </list>
///
/// Etapa 12 (AUTORIZAÇÃO): resolve o escopo do usuário autenticado primeiro
/// — CondominiumAdmin sempre vê o PRÓPRIO condomínio (o parâmetro
/// <see cref="Get"/><c>(condominiumId)</c> é ignorado nesse caso, nunca
/// usado para decidir o que ele PODE ver); SuperAdmin, por ter escopo
/// global, precisa informar qual condomínio quer ver.
/// </summary>
[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]
public sealed class AdminDashboardController(
    IAdminScopeService adminScopeService,
    ICondominiumService condominiumService,
    IMembershipAdministrationService membershipAdministrationService,
    IProfessionalAdministrationService professionalAdministrationService,
    IRecommendationAdministrationService recommendationAdministrationService,
    IBookingService bookingService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminDashboardResponse>> Get(Guid? condominiumId, CancellationToken cancellationToken)
    {
        var scope = await adminScopeService.ResolveScopeAsync(
            User.GetAdministrationRequesterRole(), User.GetUserId(), cancellationToken);

        // CondominiumAdmin: sempre o próprio (ignora qualquer condominiumId
        // recebido). SuperAdmin: precisa escolher qual condomínio ver.
        if (scope.CondominiumId is null && condominiumId is null)
        {
            return BadRequest(new
            {
                status = StatusCodes.Status400BadRequest,
                title = "Informe 'condominiumId' — como SuperAdmin, seu escopo é global.",
            });
        }

        var targetCondominiumId = scope.CondominiumId ?? condominiumId!.Value;

        var units = await condominiumService.ListUnitsAsync(
            User.GetCondominiumRequesterRole(), targetCondominiumId, targetCondominiumId, cancellationToken);

        var memberships = await membershipAdministrationService.ListByCondominiumAsync(
            User.GetResidentRequesterRole(), targetCondominiumId, targetCondominiumId, cancellationToken);
        var pendingMemberships = await membershipAdministrationService.ListPendingAsync(
            User.GetResidentRequesterRole(), targetCondominiumId, cancellationToken);

        var professionalCondominiums = await professionalAdministrationService.ListByCondominiumAsync(
            User.GetProfessionalRequesterRole(), targetCondominiumId, targetCondominiumId, cancellationToken);
        var pendingProfessionalCondominiums = await professionalAdministrationService.ListPendingCondominiumRequestsAsync(
            User.GetProfessionalRequesterRole(), targetCondominiumId, cancellationToken);

        var pendingRecommendations = await recommendationAdministrationService.ListPendingAsync(
            User.GetRecommendationRequesterRole(), targetCondominiumId, cancellationToken);

        var bookings = await bookingService.ListBookingsByCondominiumIdAsync(targetCondominiumId, cancellationToken);

        var response = new AdminDashboardResponse(
            CondominiumId: targetCondominiumId,
            Moradores: memberships.Count(m => m.Status == MembershipStatus.Active),
            Unidades: units.Count,
            Profissionais: professionalCondominiums.Count(pc => pc.Status == ProfessionalCondominiumStatus.Active),
            Agendamentos: bookings.Count,
            SolicitacoesPendentes: pendingMemberships.Count + pendingProfessionalCondominiums.Count,
            RecomendacoesPendentes: pendingRecommendations.Count);

        return Ok(response);
    }
}

/// <summary>Os seis números do dashboard administrativo (PROMPT 12) — ver comentário de design em <see cref="AdminDashboardController"/> para o que cada um conta.</summary>
public sealed record AdminDashboardResponse(
    Guid CondominiumId,
    int Moradores,
    int Unidades,
    int Profissionais,
    int Agendamentos,
    int SolicitacoesPendentes,
    int RecomendacoesPendentes);
