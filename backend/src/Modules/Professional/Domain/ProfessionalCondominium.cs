using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// "ProfessionalCondominium significa que o profissional atende aquele
/// condomínio" (PROMPT 06) — o vínculo entre um <see cref="Professional"/>
/// e um condomínio (módulo Condominium).
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>Professional</c> (mesmo módulo, mesma decisão de
/// <see cref="ProfessionalService"/> acima) nem para <c>Condominium</c>
/// (módulo Condominium — nenhum módulo referencia outro, então esta
/// entidade nem teria como declarar essa navegação). A existência do
/// condomínio é confirmada pela Api (composição raiz), da mesma forma que
/// o módulo Resident confirma unidade/condomínio antes de criar um
/// <c>CondominiumMembership</c> — ver <c>ICondominiumDirectoryService.ValidateCondominiumAsync</c>.
/// </summary>
public sealed class ProfessionalCondominium : AggregateRoot
{
    public Guid ProfessionalId { get; private set; }
    public Guid CondominiumId { get; private set; }
    public ProfessionalCondominiumStatus Status { get; private set; }
    public ProfessionalCondominiumSource Source { get; private set; }
    public DateTime CreatedAt { get; private set; }

#pragma warning disable CS8618
    private ProfessionalCondominium()
    {
    }
#pragma warning restore CS8618

    private ProfessionalCondominium(Guid id, Guid professionalId, Guid condominiumId, ProfessionalCondominiumStatus status, ProfessionalCondominiumSource source)
        : base(id)
    {
        ProfessionalId = professionalId;
        CondominiumId = condominiumId;
        Status = status;
        Source = source;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// React Native (profissional): "solicitar atendimento em
    /// condomínios" — nasce <see cref="ProfessionalCondominiumStatus.Pending"/>,
    /// aguardando um administrador aprovar ou rejeitar (ver
    /// <see cref="Approve"/>/<see cref="Reject"/>), com
    /// <see cref="ProfessionalCondominiumSource.ProfessionalRequested"/>.
    /// </summary>
    public static ProfessionalCondominium RequestService(Guid professionalId, Guid condominiumId)
    {
        ValidateIds(professionalId, condominiumId);

        return new ProfessionalCondominium(
            Guid.NewGuid(), professionalId, condominiumId, ProfessionalCondominiumStatus.Pending, ProfessionalCondominiumSource.ProfessionalRequested);
    }

    /// <summary>
    /// Vínculo criado diretamente já <see cref="ProfessionalCondominiumStatus.Active"/> —
    /// usado por um administrador para cadastrar manualmente um profissional
    /// já conhecido do condomínio (<see cref="ProfessionalCondominiumSource.AdminApproved"/>).
    /// Não aceita <see cref="ProfessionalCondominiumSource.ProfessionalRequested"/>
    /// aqui — esse caminho sempre nasce Pending (ver <see cref="RequestService"/>).
    /// </summary>
    public static ProfessionalCondominium CreateActive(Guid professionalId, Guid condominiumId, ProfessionalCondominiumSource source)
    {
        ValidateIds(professionalId, condominiumId);

        if (source == ProfessionalCondominiumSource.ProfessionalRequested)
        {
            throw new DomainException("Uma solicitação do próprio profissional nasce pendente de aprovação.");
        }

        return new ProfessionalCondominium(Guid.NewGuid(), professionalId, condominiumId, ProfessionalCondominiumStatus.Active, source);
    }

    public bool IsPending => Status == ProfessionalCondominiumStatus.Pending;

    public bool IsActive => Status == ProfessionalCondominiumStatus.Active;

    /// <summary>Aprova uma solicitação pendente — só é válido a partir de <see cref="ProfessionalCondominiumStatus.Pending"/>.</summary>
    public void Approve()
    {
        if (!IsPending)
        {
            throw new DomainException("Apenas uma solicitação pendente pode ser aprovada.");
        }

        Status = ProfessionalCondominiumStatus.Active;
    }

    /// <summary>Rejeita uma solicitação pendente — só é válido a partir de <see cref="ProfessionalCondominiumStatus.Pending"/>.</summary>
    public void Reject()
    {
        if (!IsPending)
        {
            throw new DomainException("Apenas uma solicitação pendente pode ser rejeitada.");
        }

        Status = ProfessionalCondominiumStatus.Rejected;
    }

    /// <summary>Desativa um vínculo já ativo (ex.: profissional parou de atender aquele condomínio) — só é válido a partir de <see cref="ProfessionalCondominiumStatus.Active"/>.</summary>
    public void Deactivate()
    {
        if (!IsActive)
        {
            throw new DomainException("Apenas um vínculo ativo pode ser desativado.");
        }

        Status = ProfessionalCondominiumStatus.Inactive;
    }

    private static void ValidateIds(Guid professionalId, Guid condominiumId)
    {
        if (professionalId == Guid.Empty)
        {
            throw new DomainException("O vínculo precisa de um profissional válido.");
        }

        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O vínculo precisa de um condomínio válido.");
        }
    }
}
