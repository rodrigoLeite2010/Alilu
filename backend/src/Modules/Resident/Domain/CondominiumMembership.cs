using Alilu.Shared;

namespace Alilu.Modules.Resident.Domain;

/// <summary>
/// O vínculo seguro morador↔condomínio↔unidade (PROMPT 05) — este é o
/// "elo" que, uma vez <see cref="MembershipStatus.Active"/>, autoriza um
/// <c>User</c> (módulo Identity) a entrar na área do morador de uma
/// <c>CondominiumUnit</c> (módulo Condominium) específica.
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>User</c>/<c>Condominium</c>/<c>CondominiumUnit</c>, só os Ids como
/// valores simples (mesma decisão de <c>CondominiumUnit</c>/
/// <c>CondominiumInvitation</c> no módulo Condominium, e de
/// <c>RefreshToken</c> no módulo Identity — nenhum módulo referencia
/// outro, então esta entidade nem teria como declarar uma navegação para
/// tipos de outro módulo).
///
/// SEGURANÇA (PROMPT 05): esta entidade nunca resolve por si só
/// condomínio/unidade a partir de entrada do cliente — quem monta os
/// <see cref="CondominiumId"/>/<see cref="UnitId"/> aqui é sempre a
/// Application (<c>MembershipService</c>), a partir de dados já validados
/// (o próprio convite, no FLUXO 1, ou o diretório público de condomínios/
/// unidades, no FLUXO 2 — ver Api, que é quem orquestra a consulta ao
/// módulo Condominium, já que Resident não pode referenciá-lo).
/// </summary>
public sealed class CondominiumMembership : AggregateRoot
{
    public Guid UserId { get; private set; }
    public Guid CondominiumId { get; private set; }
    public Guid UnitId { get; private set; }
    public MembershipStatus Status { get; private set; }
    public DateTime? ValidatedAt { get; private set; }
    public Guid? ValidatedBy { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

#pragma warning disable CS8618
    private CondominiumMembership()
    {
    }
#pragma warning restore CS8618

    private CondominiumMembership(
        Guid id,
        Guid userId,
        Guid condominiumId,
        Guid unitId,
        MembershipStatus status,
        DateTime? validatedAt,
        Guid? validatedBy)
        : base(id)
    {
        UserId = userId;
        CondominiumId = condominiumId;
        UnitId = unitId;
        Status = status;
        ValidatedAt = validatedAt;
        ValidatedBy = validatedBy;
        var now = DateTime.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>
    /// FLUXO 1 (convite): o convite em si já É a validação — não existe
    /// aprovação manual nesta etapa, o vínculo nasce direto
    /// <see cref="MembershipStatus.Active"/>. <see cref="ValidatedBy"/>
    /// fica nulo porque ninguém "aprovou" isto agora — a autorização já
    /// tinha sido concedida quando o administrador criou o convite
    /// (PROMPT 04); só não guardamos aqui quem criou aquele convite porque
    /// essa informação pertence ao módulo Condominium, não é replicada.
    /// </summary>
    public static CondominiumMembership CreateActiveFromInvitation(Guid userId, Guid condominiumId, Guid unitId)
    {
        ValidateIds(userId, condominiumId, unitId);

        return new CondominiumMembership(
            Guid.NewGuid(), userId, condominiumId, unitId, MembershipStatus.Active, DateTime.UtcNow, validatedBy: null);
    }

    /// <summary>
    /// FLUXO 2 (solicitação — "Não encontrei minha unidade"): nasce
    /// <see cref="MembershipStatus.Pending"/>, aguardando um administrador
    /// aprovar ou rejeitar (ver <see cref="Approve"/>/<see cref="Reject"/>).
    /// </summary>
    public static CondominiumMembership CreatePendingRequest(Guid userId, Guid condominiumId, Guid unitId)
    {
        ValidateIds(userId, condominiumId, unitId);

        return new CondominiumMembership(
            Guid.NewGuid(), userId, condominiumId, unitId, MembershipStatus.Pending, validatedAt: null, validatedBy: null);
    }

    public bool IsPending => Status == MembershipStatus.Pending;

    public bool IsActive => Status == MembershipStatus.Active;

    /// <summary>Aprova uma solicitação pendente (FLUXO 2) — só é válido a partir de <see cref="MembershipStatus.Pending"/>.</summary>
    public void Approve(Guid approvedByUserId)
    {
        if (!IsPending)
        {
            throw new DomainException("Apenas uma solicitação pendente pode ser aprovada.");
        }

        if (approvedByUserId == Guid.Empty)
        {
            throw new DomainException("É necessário informar quem aprovou o vínculo.");
        }

        Status = MembershipStatus.Active;
        ValidatedAt = DateTime.UtcNow;
        ValidatedBy = approvedByUserId;
        Touch();
    }

    /// <summary>Rejeita uma solicitação pendente (FLUXO 2) — só é válido a partir de <see cref="MembershipStatus.Pending"/>.</summary>
    public void Reject(Guid rejectedByUserId)
    {
        if (!IsPending)
        {
            throw new DomainException("Apenas uma solicitação pendente pode ser rejeitada.");
        }

        if (rejectedByUserId == Guid.Empty)
        {
            throw new DomainException("É necessário informar quem rejeitou o vínculo.");
        }

        Status = MembershipStatus.Rejected;
        ValidatedAt = DateTime.UtcNow;
        ValidatedBy = rejectedByUserId;
        Touch();
    }

    /// <summary>Bloqueia um vínculo ativo — só é válido a partir de <see cref="MembershipStatus.Active"/>.</summary>
    public void Block(Guid blockedByUserId)
    {
        if (!IsActive)
        {
            throw new DomainException("Apenas um vínculo ativo pode ser bloqueado.");
        }

        if (blockedByUserId == Guid.Empty)
        {
            throw new DomainException("É necessário informar quem bloqueou o vínculo.");
        }

        Status = MembershipStatus.Blocked;
        ValidatedAt = DateTime.UtcNow;
        ValidatedBy = blockedByUserId;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static void ValidateIds(Guid userId, Guid condominiumId, Guid unitId)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("O vínculo precisa de um usuário válido.");
        }

        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O vínculo precisa de um condomínio válido.");
        }

        if (unitId == Guid.Empty)
        {
            throw new DomainException("O vínculo precisa de uma unidade válida.");
        }
    }
}
