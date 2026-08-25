using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Uma exceção pontual à disponibilidade recorrente numa data específica
/// (PROMPT 07) — "bloquear datas"
/// (<see cref="ProfessionalAvailabilityExceptionType.Blocked"/>) ou
/// "liberar horários específicos"
/// (<see cref="ProfessionalAvailabilityExceptionType.Available"/>, ex.:
/// abrir um horário num dia que a <see cref="ProfessionalAvailability"/>
/// recorrente diria indisponível).
///
/// "Exceções devem sobrescrever a disponibilidade recorrente" (regra do
/// PROMPT 07): ao resolver a disponibilidade efetiva de uma data, uma
/// exceção sempre tem prioridade sobre a agenda recorrente. Essa
/// *resolução* (combinar agenda + exceções num resultado final consultável,
/// ex. por hora) fica para quando um módulo de agenda/reservas precisar
/// dela — "Ainda NÃO criar Booking" (PROMPT 07); esta etapa só guarda o
/// dado bruto, já com a garantia de que ele existe isolado por data e é
/// consultado (e ordenado) antes da agenda recorrente pelas telas React
/// Native (BlockedDatesScreen/CalendarAvailabilityScreen) — ver
/// ARCHITECTURE.md.
///
/// <see cref="StartTime"/>/<see cref="EndTime"/> são ambos <c>null</c> em
/// conjunto para representar o dia inteiro (ex.: "bloquear datas" de um
/// feriado completo); quando informados (sempre os dois juntos), valem só
/// para aquele intervalo dentro do dia (ex.: liberar 14:00-16:00 numa
/// quarta normalmente indisponível).
///
/// É sua própria raiz de agregado, mesma decisão das demais entidades deste
/// módulo — só <see cref="ProfessionalId"/> como valor simples, sem
/// navegação/FK para <c>Professional</c>.
/// </summary>
public sealed class ProfessionalAvailabilityException : AggregateRoot
{
    public Guid ProfessionalId { get; private set; }

    /// <summary>Só a data civil (sem horário/fuso embutido) — mesma razão de <c>TimeOnly</c> em <see cref="ProfessionalAvailability"/>, ver lá.</summary>
    public DateOnly Date { get; private set; }

    public TimeOnly? StartTime { get; private set; }
    public TimeOnly? EndTime { get; private set; }
    public ProfessionalAvailabilityExceptionType Type { get; private set; }
    public string? Reason { get; private set; }

#pragma warning disable CS8618
    private ProfessionalAvailabilityException()
    {
    }
#pragma warning restore CS8618

    private ProfessionalAvailabilityException(
        Guid id,
        Guid professionalId,
        DateOnly date,
        TimeOnly? startTime,
        TimeOnly? endTime,
        ProfessionalAvailabilityExceptionType type,
        string? reason)
        : base(id)
    {
        ProfessionalId = professionalId;
        Date = date;
        StartTime = startTime;
        EndTime = endTime;
        Type = type;
        Reason = reason;
    }

    /// <summary>
    /// Cria uma exceção de disponibilidade. "Não permitir horários
    /// sobrepostos" (aqui, entre exceções da mesma data — ver
    /// <see cref="OverlapsWith"/>) e a existência do profissional são
    /// responsabilidade da Application; aqui só a validação própria da
    /// entidade.
    /// </summary>
    public static ProfessionalAvailabilityException Create(
        Guid professionalId,
        DateOnly date,
        TimeOnly? startTime,
        TimeOnly? endTime,
        ProfessionalAvailabilityExceptionType type,
        string? reason)
    {
        if (professionalId == Guid.Empty)
        {
            throw new DomainException("A exceção precisa de um profissional válido.");
        }

        if (startTime.HasValue != endTime.HasValue)
        {
            throw new DomainException("Informe início e término juntos, ou nenhum dos dois para o dia inteiro.");
        }

        if (startTime.HasValue && endTime.HasValue && startTime.Value >= endTime.Value)
        {
            throw new DomainException("O horário de início precisa ser anterior ao horário de término.");
        }

        var trimmedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        if (trimmedReason is { Length: > 500 })
        {
            throw new DomainException("O motivo não pode ter mais de 500 caracteres.");
        }

        return new ProfessionalAvailabilityException(Guid.NewGuid(), professionalId, date, startTime, endTime, type, trimmedReason);
    }

    /// <summary><c>StartTime</c>/<c>EndTime</c> nulos em conjunto — a exceção cobre o dia inteiro.</summary>
    public bool IsFullDay => StartTime is null && EndTime is null;

    /// <summary>
    /// Sobreposição com outro intervalo candidato na mesma data — usado
    /// pela Application para checar "não permitir horários sobrepostos"
    /// entre exceções da mesma data (<paramref name="otherStart"/>/
    /// <paramref name="otherEnd"/> nulos em conjunto = dia inteiro, que
    /// sobrepõe qualquer coisa). Não compara datas — a Application já
    /// filtra por <see cref="Date"/> antes de chamar isto.
    /// </summary>
    public bool OverlapsWith(TimeOnly? otherStart, TimeOnly? otherEnd)
    {
        var otherIsFullDay = otherStart is null && otherEnd is null;

        if (IsFullDay || otherIsFullDay)
        {
            return true;
        }

        return StartTime!.Value < otherEnd!.Value && otherStart!.Value < EndTime!.Value;
    }
}
