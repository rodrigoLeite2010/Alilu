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

    /// <summary>
    /// Etapa 19 (agenda/disponibilidade — pedido de produto: "a profissional
    /// deve conseguir configurar sua agenda para um único dia, uma semana,
    /// um mês, um período personalizado OU uma rotina semanal recorrente").
    /// Ambos <c>null</c> (comportamento de todas as linhas criadas antes
    /// desta etapa, preservado por padrão) = recorrente para sempre, sem
    /// data de início/fim — o significado original deste tipo desde o
    /// PROMPT 07, sem nenhuma mudança de comportamento para quem só usa
    /// <see cref="Create"/> com os três argumentos originais.
    ///
    /// Quando informados, o intervalo só é considerado (ver
    /// <see cref="IsEffectiveOn"/>) dentro de [<see cref="EffectiveFrom"/>,
    /// <see cref="EffectiveUntil"/>] — é assim que UMA ÚNICA entidade cobre
    /// tanto "disponibilidade recorrente" quanto "disponibilidade específica
    /// por período" (ex.: "só em setembro") sem precisar de uma segunda
    /// entidade/tabela nem gerar um registro por dia individual (pedido
    /// explícito: "permita trabalhar com disponibilidade recorrente sem
    /// necessariamente gerar milhares de registros individuais") — ver
    /// ARCHITECTURE.md, "Etapa 19".
    /// </summary>
    public DateOnly? EffectiveFrom { get; private set; }

    public DateOnly? EffectiveUntil { get; private set; }

#pragma warning disable CS8618
    private ProfessionalAvailability()
    {
    }
#pragma warning restore CS8618

    private ProfessionalAvailability(
        Guid id,
        Guid professionalId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        DateOnly? effectiveFrom,
        DateOnly? effectiveUntil)
        : base(id)
    {
        ProfessionalId = professionalId;
        DayOfWeek = dayOfWeek;
        StartTime = startTime;
        EndTime = endTime;
        EffectiveFrom = effectiveFrom;
        EffectiveUntil = effectiveUntil;
        Active = true;
    }

    /// <summary>
    /// Cria um intervalo de disponibilidade. "Não permitir horários
    /// sobrepostos" é responsabilidade da Application (precisa consultar os
    /// demais intervalos do profissional para comparar — ver
    /// <see cref="OverlapsWith"/> e
    /// <c>ProfessionalAvailabilityService.EnsureNoOverlapAsync</c>); esta
    /// entidade, isolada, só valida a própria consistência ("Não permitir
    /// StartTime &gt;= EndTime", e agora "EffectiveFrom não pode ser depois
    /// de EffectiveUntil"). <paramref name="effectiveFrom"/>/
    /// <paramref name="effectiveUntil"/> são opcionais (ambos <c>null</c> por
    /// padrão) — ver comentário do campo para o que isso significa.
    /// </summary>
    public static ProfessionalAvailability Create(
        Guid professionalId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        DateOnly? effectiveFrom = null,
        DateOnly? effectiveUntil = null)
    {
        if (professionalId == Guid.Empty)
        {
            throw new DomainException("A disponibilidade precisa de um profissional válido.");
        }

        ValidateTimeRange(startTime, endTime);
        ValidateDateRange(effectiveFrom, effectiveUntil);

        return new ProfessionalAvailability(Guid.NewGuid(), professionalId, dayOfWeek, startTime, endTime, effectiveFrom, effectiveUntil);
    }

    /// <summary>React Native: AvailabilityEditor — "configurar dias; configurar horários" (edição de um intervalo já existente, não altera <see cref="Active"/>). Sem argumentos de data, preserva o período de validade atual do intervalo (comportamento idêntico ao de antes da Etapa 19 para quem só edita dia/horário).</summary>
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
    /// Este intervalo recorrente vale para <paramref name="date"/>? Verifica
    /// só o período de validade (<see cref="EffectiveFrom"/>/
    /// <see cref="EffectiveUntil"/>) — NÃO verifica <see cref="DayOfWeek"/>
    /// nem <see cref="Active"/>, que continuam responsabilidade de quem
    /// chama (mesmo padrão dos demais métodos desta entidade, que nunca
    /// combinam mais de uma regra por método).
    /// </summary>
    public bool IsEffectiveOn(DateOnly date) =>
        (EffectiveFrom is null || date >= EffectiveFrom.Value) && (EffectiveUntil is null || date <= EffectiveUntil.Value);

    /// <summary>
    /// Sobreposição com outro intervalo candidato — mesmo dia da semana,
    /// interseção de horário ([a,b) sobrepõe [c,d) quando a &lt; d e c &lt;
    /// b) E interseção de período de validade. <paramref name="otherEffectiveFrom"/>/
    /// <paramref name="otherEffectiveUntil"/> são opcionais (ambos
    /// <c>null</c> por padrão = candidato recorrente indefinido, que sempre
    /// intersecta qualquer período) — assim as chamadas já existentes desde
    /// o PROMPT 07 (<c>ProfessionalAvailabilityService.EnsureNoOverlapAsync</c>,
    /// que só edita/adiciona intervalos indefinidos um de cada vez) continuam
    /// se comportando EXATAMENTE como antes, sem mudança de assinatura
    /// obrigatória. A nova checagem "por período" só entra em jogo quando
    /// quem chama (o novo <c>SetBulkAvailabilityAsync</c>, Etapa 19) informa
    /// datas de verdade.
    /// </summary>
    public bool OverlapsWith(
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        DateOnly? otherEffectiveFrom = null,
        DateOnly? otherEffectiveUntil = null)
    {
        if (DayOfWeek != dayOfWeek || !(StartTime < endTime && startTime < EndTime))
        {
            return false;
        }

        // Duas faixas [a,b]/[c,d] (nulo = sem limite) NÃO se intersectam só
        // quando uma termina antes da outra começar.
        if (EffectiveUntil is not null && otherEffectiveFrom is not null && EffectiveUntil.Value < otherEffectiveFrom.Value)
        {
            return false;
        }

        if (otherEffectiveUntil is not null && EffectiveFrom is not null && otherEffectiveUntil.Value < EffectiveFrom.Value)
        {
            return false;
        }

        return true;
    }

    private static void ValidateTimeRange(TimeOnly startTime, TimeOnly endTime)
    {
        if (startTime >= endTime)
        {
            throw new DomainException("O horário de início precisa ser anterior ao horário de término.");
        }
    }

    private static void ValidateDateRange(DateOnly? effectiveFrom, DateOnly? effectiveUntil)
    {
        if (effectiveFrom is not null && effectiveUntil is not null && effectiveFrom.Value > effectiveUntil.Value)
        {
            throw new DomainException("A data final precisa ser igual ou depois da data inicial.");
        }
    }
}

/// <summary>
/// Etapa 19 — períodos padrão "manhã/tarde/noite" centralizados aqui (pedido
/// explícito: "esses horários devem ser centralizados em configuração ou
/// constantes de domínio, evitando valores espalhados pelo código"). Único
/// consumidor hoje é a composição de "Minha Agenda"
/// (<c>Alilu.Api.Controllers.ProfessionalAgendaController</c>, que precisa
/// bucketizar janelas livres/ocupadas em três faixas fixas para a UI
/// resumida da tela); a Api de "adicionar disponibilidade"/"rotina semanal"
/// aceita qualquer horário (não só estes três) — são só o ATALHO que a
/// interface do profissional oferece, nunca uma restrição do domínio. O
/// mobile mantém uma cópia destes mesmos três valores (mesma convenção de
/// duplicação intencional de <c>DAY_OF_WEEK_LABEL</c>/<c>MONTH_LABEL</c>
/// entre módulos deste projeto) — mudar um valor aqui exige atualizar a
/// cópia em <c>professional/availabilityFormat.ts#STANDARD_PERIODS</c>.
/// </summary>
public static class ProfessionalAvailabilityPeriods
{
    public static readonly StandardPeriod Morning = new("Manhã", new TimeOnly(7, 0), new TimeOnly(12, 0));

    public static readonly StandardPeriod Afternoon = new("Tarde", new TimeOnly(12, 0), new TimeOnly(18, 0));

    public static readonly StandardPeriod Evening = new("Noite", new TimeOnly(18, 0), new TimeOnly(22, 0));

    public static readonly IReadOnlyList<StandardPeriod> All = new[] { Morning, Afternoon, Evening };
}

/// <summary>Um período padrão nomeado ("Manhã", 07:00-12:00) — ver <see cref="ProfessionalAvailabilityPeriods"/>.</summary>
public sealed record StandardPeriod(string Name, TimeOnly Start, TimeOnly End);
