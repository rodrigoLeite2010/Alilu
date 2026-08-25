using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Um intervalo de horário recorrente em que o profissional está disponível
/// num dia da semana (PROMPT 07) — ex.: "Segunda 08:00-12:00". Um mesmo
/// profissional pode ter vários intervalos no mesmo dia (ex.: manhã e
/// tarde, com um intervalo de almoço no meio — "Segunda: 08:00-12:00,
/// 13:00-17:00", exemplo do próprio PROMPT 07). Um dia sem nenhum intervalo
/// <see cref="Active"/> é, por definição, "indisponível" (exemplo da
/// Quarta no PROMPT 07) — não existe um valor próprio para "indisponível",
/// é só a ausência de intervalos.
///
/// Timezone (regra do PROMPT 07 — "Timezone deverá ser tratado
/// corretamente"): <see cref="StartTime"/>/<see cref="EndTime"/> usam
/// <c>TimeOnly</c>, não <c>DateTime</c> — um horário de parede (civil)
/// puro, sem fuso nem data embutidos, evitando exatamente a ambiguidade de
/// fuso/<c>DateTime.Kind</c> que <c>DateTime</c> traria para um dado que é,
/// por natureza, só "08:00" (não importa o fuso do servidor que salvou nem
/// o fuso do dispositivo que exibe). O PROMPT 07 não pediu um campo de fuso
/// horário na lista de entidades, então nenhum foi adicionado — ver
/// ARCHITECTURE.md para a decisão completa.
///
/// É sua própria raiz de agregado — mesma decisão das demais entidades
/// deste módulo (ver <c>ProfessionalService</c>): só
/// <see cref="ProfessionalId"/> como valor simples, sem navegação/FK para
/// <c>Professional</c>.
/// </summary>
public sealed class ProfessionalAvailability : AggregateRoot
{
    public Guid ProfessionalId { get; private set; }

    /// <summary><c>System.DayOfWeek</c> — enum nativo do .NET, não um tipo próprio deste módulo.</summary>
    public DayOfWeek DayOfWeek { get; private set; }

    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public bool Active { get; private set; }

#pragma warning disable CS8618
    private ProfessionalAvailability()
    {
    }
#pragma warning restore CS8618

    private ProfessionalAvailability(Guid id, Guid professionalId, DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime)
        : base(id)
    {
        ProfessionalId = professionalId;
        DayOfWeek = dayOfWeek;
        StartTime = startTime;
        EndTime = endTime;
        Active = true;
    }

    /// <summary>
    /// Cria um intervalo de disponibilidade. "Não permitir horários
    /// sobrepostos" é responsabilidade da Application (precisa consultar os
    /// demais intervalos do profissional para comparar — ver
    /// <see cref="OverlapsWith"/> e
    /// <c>ProfessionalAvailabilityService.EnsureNoOverlapAsync</c>); esta
    /// entidade, isolada, só valida a própria consistência ("Não permitir
    /// StartTime &gt;= EndTime").
    /// </summary>
    public static ProfessionalAvailability Create(Guid professionalId, DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime)
    {
        if (professionalId == Guid.Empty)
        {
            throw new DomainException("A disponibilidade precisa de um profissional válido.");
        }

        ValidateTimeRange(startTime, endTime);

        return new ProfessionalAvailability(Guid.NewGuid(), professionalId, dayOfWeek, startTime, endTime);
    }

    /// <summary>React Native: AvailabilityEditor — "configurar dias; configurar horários" (edição de um intervalo já existente, não altera <see cref="Active"/>).</summary>
    public void Reschedule(DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime)
    {
        ValidateTimeRange(startTime, endTime);

        DayOfWeek = dayOfWeek;
        StartTime = startTime;
        EndTime = endTime;
    }

    /// <summary>Remoção lógica (API: "DELETE availability") — mesmo padrão de desativação do restante do módulo (ver <c>ProfessionalService.Deactivate</c>). Sem guarda: chamar duas vezes é inofensivo (idempotente).</summary>
    public void Deactivate() => Active = false;

    public void Activate() => Active = true;

    /// <summary>
    /// Sobreposição com outro intervalo candidato (mesmo dia da semana e
    /// interseção de horário) — usado pela Application para checar "não
    /// permitir horários sobrepostos" contra os demais intervalos do
    /// profissional. Interseção clássica de intervalos: [a,b) sobrepõe
    /// [c,d) quando a &lt; d e c &lt; b.
    /// </summary>
    public bool OverlapsWith(DayOfWeek dayOfWeek, TimeOnly startTime, TimeOnly endTime) =>
        DayOfWeek == dayOfWeek && StartTime < endTime && startTime < EndTime;

    private static void ValidateTimeRange(TimeOnly startTime, TimeOnly endTime)
    {
        if (startTime >= endTime)
        {
            throw new DomainException("O horário de início precisa ser anterior ao horário de término.");
        }
    }
}
