using Alilu.Shared;

namespace Alilu.Modules.Scheduling.Domain;

/// <summary>
/// Uma solicitação de agendamento de um morador com um profissional (PROMPT
/// 08 — "o módulo mais crítico"): fluxo do morador — "escolher profissional
/// → escolher data → verificar disponibilidade → escolher horário →
/// selecionar serviços → adicionar observações → enviar solicitação" —
/// seguido do fluxo do profissional — "receber solicitação → aceitar ou
/// recusar".
///
/// É sua própria raiz de agregado — mesma decisão de todas as entidades dos
/// módulos anteriores: de propósito NÃO há navegação/FK para <c>User</c>
/// (Identity), <c>Professional</c>/<c>ProfessionalAvailability*</c>
/// (Professional) nem <c>Condominium</c>/<c>CondominiumUnit</c>
/// (Condominium) — só os Ids como valores simples. As REGRAS CRÍTICAS do
/// prompt que dependem de outro módulo ("só morador com Membership Active",
/// "profissional deve atender o condomínio", "o horário deve estar
/// disponível") são responsabilidade da Api (composição raiz) ANTES de
/// chamar <c>BookingService.CreateBookingAsync</c> — ver
/// <c>BookingsController</c> e ARCHITECTURE.md, "Etapa 08 — composição". A
/// única regra de conflito que esta entidade/módulo pode e deve garantir
/// sozinha é "nenhum outro agendamento deste profissional, nesta data,
/// colide com este horário" (<see cref="OverlapsWith"/>), porque
/// <c>Booking</c> é o único dado envolvido que pertence a este módulo.
///
/// <see cref="ResidentId"/> é o próprio <c>User.Id</c> do morador (mesma
/// convenção de <c>CondominiumMembership.UserId</c> no módulo Resident —
/// não existe uma entidade "Resident" própria). <see cref="ProfessionalId"/>
/// é o <c>Professional.Id</c> (perfil profissional, módulo Professional) —
/// nunca o <c>User.Id</c> do profissional; é a Api quem resolve esse Id a
/// partir do usuário autenticado antes de chamar os métodos do profissional
/// (ver <c>ProfessionalBookingsController</c>).
///
/// Timezone: mesma decisão da Etapa 07 (disponibilidade) — <c>ScheduledDate</c>
/// usa <c>DateOnly</c> e <c>StartTime</c>/<c>EndTime</c> usam <c>TimeOnly</c>,
/// nunca <c>DateTime</c>, evitando qualquer ambiguidade de fuso.
/// </summary>
public sealed class Booking : AggregateRoot
{
    public Guid ResidentId { get; private set; }
    public Guid ProfessionalId { get; private set; }
    public Guid CondominiumId { get; private set; }
    public Guid UnitId { get; private set; }
    public DateOnly ScheduledDate { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }
    public BookingStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

#pragma warning disable CS8618
    private Booking()
    {
    }
#pragma warning restore CS8618

    private Booking(
        Guid id,
        Guid residentId,
        Guid professionalId,
        Guid condominiumId,
        Guid unitId,
        DateOnly scheduledDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string? notes)
        : base(id)
    {
        ResidentId = residentId;
        ProfessionalId = professionalId;
        CondominiumId = condominiumId;
        UnitId = unitId;
        ScheduledDate = scheduledDate;
        StartTime = startTime;
        EndTime = endTime;
        Notes = notes;
        Status = BookingStatus.Requested;
        var now = DateTime.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// Cria a solicitação (React Native: BookingConfirmationScreen — passo
    /// final do fluxo do morador). Nasce sempre <see cref="BookingStatus.Requested"/>.
    /// Todas as REGRAS CRÍTICAS que dependem de outro módulo (Membership
    /// Active, profissional atende o condomínio, horário disponível) já
    /// devem ter sido validadas por quem chama (a Api) — esta entidade,
    /// isolada, só valida a própria consistência interna.
    /// </summary>
    public static Booking Request(
        Guid residentId,
        Guid professionalId,
        Guid condominiumId,
        Guid unitId,
        DateOnly scheduledDate,
        TimeOnly startTime,
        TimeOnly endTime,
        string? notes)
    {
        if (residentId == Guid.Empty)
        {
            throw new DomainException("O agendamento precisa de um morador válido.");
        }

        if (professionalId == Guid.Empty)
        {
            throw new DomainException("O agendamento precisa de um profissional válido.");
        }

        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O agendamento precisa de um condomínio válido.");
        }

        if (unitId == Guid.Empty)
        {
            throw new DomainException("O agendamento precisa de uma unidade válida.");
        }

        if (startTime >= endTime)
        {
            throw new DomainException("O horário de início precisa ser anterior ao horário de término.");
        }

        var trimmedNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        if (trimmedNotes is { Length: > 1000 })
        {
            throw new DomainException("As observações não podem ter mais de 1000 caracteres.");
        }

        return new Booking(Guid.NewGuid(), residentId, professionalId, condominiumId, unitId, scheduledDate, startTime, endTime, trimmedNotes);
    }

    /// <summary>
    /// Status que ainda "seguram" o horário na agenda do profissional — usado
    /// para checar conflito (<see cref="OverlapsWith"/>) contra novas
    /// solicitações. <see cref="BookingStatus.Rejected"/>/
    /// <see cref="BookingStatus.CancelledByResident"/>/
    /// <see cref="BookingStatus.CancelledByProfessional"/>/
    /// <see cref="BookingStatus.NoShow"/> liberam o horário para um novo
    /// agendamento.
    /// </summary>
    public bool OccupiesSlot =>
        Status is BookingStatus.Requested or BookingStatus.Confirmed or BookingStatus.InProgress or BookingStatus.Completed;

    /// <summary>
    /// Sobreposição com outro agendamento candidato do MESMO profissional,
    /// na MESMA data — só considera <c>this</c> quando <see cref="OccupiesSlot"/>
    /// (um agendamento rejeitado/cancelado/no-show nunca bloqueia um novo).
    /// Interseção clássica de intervalos, mesma fórmula de
    /// <c>ProfessionalAvailability.OverlapsWith</c> (Etapa 07): [a,b)
    /// sobrepõe [c,d) quando a &lt; d e c &lt; b.
    /// </summary>
    public bool OverlapsWith(Guid professionalId, DateOnly scheduledDate, TimeOnly startTime, TimeOnly endTime) =>
        OccupiesSlot
        && ProfessionalId == professionalId
        && ScheduledDate == scheduledDate
        && StartTime < endTime
        && startTime < EndTime;

    /// <summary>React Native: ProfessionalRequestsScreen — "aceitar". Só é válido a partir de <see cref="BookingStatus.Requested"/>.</summary>
    public void Confirm()
    {
        EnsureStatus(BookingStatus.Requested, "Apenas uma solicitação pendente pode ser aceita.");
        Status = BookingStatus.Confirmed;
        Touch();
    }

    /// <summary>React Native: ProfessionalRequestsScreen — "recusar". Só é válido a partir de <see cref="BookingStatus.Requested"/>.</summary>
    public void Reject()
    {
        EnsureStatus(BookingStatus.Requested, "Apenas uma solicitação pendente pode ser recusada.");
        Status = BookingStatus.Rejected;
        Touch();
    }

    /// <summary>
    /// "Cancelamentos devem respeitar regras de negócio" (REGRA CRÍTICA do
    /// prompt): o morador só pode cancelar enquanto o atendimento ainda não
    /// começou (Requested ou Confirmed) — depois de <see cref="BookingStatus.InProgress"/>
    /// ou <see cref="BookingStatus.Completed"/> não há mais o que cancelar.
    /// React Native: MyBookingsScreen/BookingDetailsScreen.
    /// </summary>
    public void CancelByResident()
    {
        EnsureCancellable("O morador só pode cancelar um agendamento que ainda não começou.");
        Status = BookingStatus.CancelledByResident;
        Touch();
    }

    /// <summary>Mesma regra de <see cref="CancelByResident"/>, do lado do profissional. React Native: ProfessionalRequestsScreen/BookingDetailsScreen.</summary>
    public void CancelByProfessional()
    {
        EnsureCancellable("O profissional só pode cancelar um agendamento que ainda não começou.");
        Status = BookingStatus.CancelledByProfessional;
        Touch();
    }

    /// <summary>O profissional marca o início do atendimento — só é válido a partir de <see cref="BookingStatus.Confirmed"/>.</summary>
    public void MarkInProgress()
    {
        EnsureStatus(BookingStatus.Confirmed, "Apenas um agendamento confirmado pode iniciar o atendimento.");
        Status = BookingStatus.InProgress;
        Touch();
    }

    /// <summary>React Native: ProfessionalRequestsScreen — "concluir". Válido a partir de Confirmed (o profissional pulou o marco "iniciar") ou InProgress.</summary>
    public void Complete()
    {
        if (Status is not (BookingStatus.Confirmed or BookingStatus.InProgress))
        {
            throw new DomainException("Apenas um agendamento confirmado ou em andamento pode ser concluído.");
        }

        Status = BookingStatus.Completed;
        Touch();
    }

    /// <summary>O morador confirmou o horário mas não esteve presente — válido a partir de Confirmed ou InProgress, mesma janela de <see cref="Complete"/>.</summary>
    public void MarkNoShow()
    {
        if (Status is not (BookingStatus.Confirmed or BookingStatus.InProgress))
        {
            throw new DomainException("Apenas um agendamento confirmado ou em andamento pode ser marcado como não comparecido.");
        }

        Status = BookingStatus.NoShow;
        Touch();
    }

    private void EnsureCancellable(string message)
    {
        if (Status is not (BookingStatus.Requested or BookingStatus.Confirmed))
        {
            throw new DomainException(message);
        }
    }

    private void EnsureStatus(BookingStatus expected, string message)
    {
        if (Status != expected)
        {
            throw new DomainException(message);
        }
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
