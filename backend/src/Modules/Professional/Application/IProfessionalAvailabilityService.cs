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
}
