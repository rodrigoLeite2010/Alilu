using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Casos de uso self-service de disponibilidade (PROMPT 07) — qualquer
/// usuário autenticado pode chamar, sempre restrito ao próprio perfil
/// profissional (<c>userId</c>), mesmo espírito de
/// <see cref="IProfessionalProfileService"/>.
/// </summary>
public interface IProfessionalAvailabilityService
{
    /// <summary>
    /// Agenda recorrente + exceções, numa única consulta — as quatro telas
    /// React Native pedidas (AvailabilityScreen/AvailabilityEditor/
    /// BlockedDatesScreen/CalendarAvailabilityScreen) partem todas daqui
    /// (ver <c>ProfessionalAvailabilityOverviewResponse</c> e
    /// ARCHITECTURE.md sobre esta decisão de design da API).
    /// </summary>
    Task<ProfessionalAvailabilityOverviewResponse> GetMyAvailabilityAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>React Native: AvailabilityEditor — "configurar dias; configurar horários". Valida "não permitir horários sobrepostos" contra os demais intervalos Active do profissional.</summary>
    Task<ProfessionalAvailabilityResponse> AddAvailabilityAsync(
        Guid userId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: AvailabilityEditor — edição de um intervalo já existente (mesma validação de sobreposição, ignorando o próprio intervalo sendo editado).</summary>
    Task<ProfessionalAvailabilityResponse> UpdateAvailabilityAsync(
        Guid userId,
        Guid availabilityId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken = default);

    /// <summary>Remoção lógica de um intervalo (desativação, não exclusão — mesmo padrão do restante do módulo).</summary>
    Task RemoveAvailabilityAsync(Guid userId, Guid availabilityId, CancellationToken cancellationToken = default);

    /// <summary>React Native: BlockedDatesScreen — "bloquear datas; liberar horários específicos". <paramref name="startTime"/>/<paramref name="endTime"/> nulos em conjunto = dia inteiro.</summary>
    Task<ProfessionalAvailabilityExceptionResponse> AddExceptionAsync(
        Guid userId,
        DateOnly date,
        TimeOnly? startTime,
        TimeOnly? endTime,
        ProfessionalAvailabilityExceptionType type,
        string? reason,
        CancellationToken cancellationToken = default);

    /// <summary>Exclusão definitiva de uma exceção — ver <see cref="IProfessionalAvailabilityExceptionRepository.RemoveAsync"/>.</summary>
    Task RemoveExceptionAsync(Guid userId, Guid exceptionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 19 (agenda e disponibilidade) — cadastro em massa: um ou mais
    /// dias da semana × um ou mais períodos, de uma vez só, opcionalmente
    /// limitado a [<paramref name="effectiveFrom"/>, <paramref name="effectiveUntil"/>].
    /// Um único método cobre TRÊS fluxos da interface (todos "adicionar N
    /// intervalos recorrentes/limitados de uma vez", só variando o que a
    /// tela pré-preenche antes de chamar):
    /// <list type="bullet">
    /// <item>"+ Adicionar disponibilidade" com um atalho de período (Hoje/
    /// Esta semana/Este mês/Personalizado) — <paramref name="effectiveFrom"/>
    /// e <paramref name="effectiveUntil"/> vêm preenchidos pela tela a partir
    /// do atalho escolhido.</item>
    /// <item>"📅 Configurar rotina semanal" — "repetir toda semana" manda os
    /// dois nulos (recorrente para sempre); "repetir até uma data" manda só
    /// <paramref name="effectiveUntil"/>.</item>
    /// <item>Disponibilidade em massa (período + dias + horários) — mesma
    /// coisa do primeiro item, nome diferente na tela.</item>
    /// </list>
    /// Tudo-ou-nada: se qualquer combinação dia×período colidir com um
    /// intervalo já existente (<see cref="Domain.ProfessionalAvailability.OverlapsWith"/>,
    /// agora também considerando a interseção de datas), a chamada INTEIRA
    /// falha com <see cref="OverlappingAvailabilityException"/> antes de
    /// gravar qualquer coisa — mais simples e previsível do que "salvar o
    /// que não colidiu e avisar quais colidiram"; ver ARCHITECTURE.md,
    /// "Etapa 19", para a decisão completa (e como evoluir se um dia for
    /// preciso um comportamento mais tolerante).
    /// </summary>
    Task<IReadOnlyList<ProfessionalAvailabilityResponse>> SetBulkAvailabilityAsync(
        Guid userId,
        IReadOnlyList<DayOfWeek> daysOfWeek,
        IReadOnlyList<AvailabilityPeriodInput> periods,
        DateOnly? effectiveFrom,
        DateOnly? effectiveUntil,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 19 — versão self-service, POR INTERVALO DE DATAS, de
    /// <see cref="ListOpenWindowsAsync"/> (que só resolve uma data por vez,
    /// pensado para o morador escolhendo UM horário). Base da tela "Minha
    /// Agenda": busca a agenda recorrente e TODAS as exceções do
    /// profissional uma única vez (duas consultas, não uma por dia do
    /// intervalo) e resolve cada data em memória com o mesmo
    /// <c>OpenWindowResolver</c> usado por <see cref="ListOpenWindowsAsync"/>.
    /// NÃO considera agendamentos (módulo Scheduling) — quem faz essa
    /// composição final é a Api (<c>ProfessionalAgendaController</c>), mesmo
    /// desenho de <see cref="ListOpenWindowsAsync"/>. Limita o intervalo a
    /// 62 dias (mesmo limite de <c>ProfessionalDirectoryController.ListAvailableDates</c>)
    /// lançando <see cref="Alilu.Shared.DomainException"/> quando excedido.
    /// </summary>
    Task<IReadOnlyList<DailyOpenWindowsResponse>> GetMyOpenWindowsRangeAsync(
        Guid userId,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken = default);
}
