using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Nunca inclui dados de outro módulo (nome/e-mail do usuário via Identity, dados do condomínio via Condominium) — só o que este módulo guarda. Enriquecer para exibição é responsabilidade da Api.</summary>
public sealed record ProfessionalResponse(
    Guid Id,
    Guid UserId,
    string DisplayName,
    string? Description,
    string? Phone,
    string? PhotoUrl,
    ProfessionalStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ServiceCategoryResponse(
    Guid Id,
    string Name,
    string? Description,
    bool Active);

public sealed record ProfessionalServiceResponse(
    Guid Id,
    Guid ProfessionalId,
    Guid ServiceCategoryId,
    string? Description,
    bool Active);

public sealed record ProfessionalCondominiumResponse(
    Guid Id,
    Guid ProfessionalId,
    Guid CondominiumId,
    ProfessionalCondominiumStatus Status,
    ProfessionalCondominiumSource Source,
    DateTime CreatedAt);

/// <summary>
/// Item de diretório público (React Native: ProfessionalListScreen/
/// ProfessionalProfileScreen — "listar profissionais; filtrar categoria;
/// visualizar perfil"). Combina <see cref="Domain.Professional"/> com as
/// categorias dos seus serviços ativos — dado que os dois pertencem a este
/// mesmo módulo, não é o mesmo tipo de "enriquecimento entre módulos" que
/// <see cref="ProfessionalResponse"/> evita.
/// </summary>
public sealed record ProfessionalDirectoryItemResponse(
    Guid Id,
    string DisplayName,
    string? Description,
    string? Phone,
    string? PhotoUrl,
    IReadOnlyList<ServiceCategoryResponse> Categories);

/// <summary>Um intervalo recorrente de disponibilidade (PROMPT 07, React Native: AvailabilityScreen/AvailabilityEditor).</summary>
public sealed record ProfessionalAvailabilityResponse(
    Guid Id,
    Guid ProfessionalId,
    DayOfWeek DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    bool Active);

/// <summary>Uma exceção pontual à disponibilidade recorrente (PROMPT 07, React Native: BlockedDatesScreen/CalendarAvailabilityScreen). <see cref="StartTime"/>/<see cref="EndTime"/> nulos em conjunto = dia inteiro.</summary>
public sealed record ProfessionalAvailabilityExceptionResponse(
    Guid Id,
    Guid ProfessionalId,
    DateOnly Date,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    ProfessionalAvailabilityExceptionType Type,
    string? Reason);

/// <summary>
/// Resposta de <c>GET .../availability</c> — agenda recorrente e exceções
/// juntas, numa única consulta (PROMPT 07 só lista um único verbo GET na
/// API; ver <c>ProfessionalAvailabilityController</c> e ARCHITECTURE.md
/// sobre esta decisão). As quatro telas React Native pedidas
/// (AvailabilityScreen/AvailabilityEditor/BlockedDatesScreen/
/// CalendarAvailabilityScreen) partem todas desta mesma resposta.
/// </summary>
public sealed record ProfessionalAvailabilityOverviewResponse(
    IReadOnlyList<ProfessionalAvailabilityResponse> WeeklySchedule,
    IReadOnlyList<ProfessionalAvailabilityExceptionResponse> Exceptions);

/// <summary>
/// Uma janela de horário em que o profissional está aberto numa data
/// (decisão atualizada — ver <see cref="IProfessionalDirectoryService.ListOpenWindowsAsync"/>
/// para o histórico da mudança de "nunca expor a agenda" para "só expor
/// as janelas livres"). Resolvida a partir da agenda recorrente + exceções
/// da Etapa 07 — NÃO considera agendamentos já feitos (módulo Scheduling,
/// que este módulo não pode referenciar): é a Api quem subtrai isso antes
/// de devolver ao morador, ver <c>ProfessionalDirectoryController.ListAvailabilityWindows</c>.
/// </summary>
public sealed record OpenTimeWindowResponse(TimeOnly StartTime, TimeOnly EndTime);
