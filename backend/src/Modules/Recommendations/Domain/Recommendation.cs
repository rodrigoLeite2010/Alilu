using Alilu.Shared;

namespace Alilu.Modules.Recommendations.Domain;

/// <summary>
/// A indicação de um profissional feita por um morador (PROMPT 10) — uma
/// Recommendation é diferente de uma <c>Review</c> (Etapa 09): Review é
/// sobre um serviço realizado DENTRO do ALILU (agendamento); Recommendation
/// é uma indicação de confiança, que pode se referir a um profissional que
/// nunca foi contratado pelo ALILU (indicação externa).
///
/// É sua própria raiz de agregado — mesma decisão de todos os módulos
/// anteriores: de propósito NÃO há navegação/FK para <c>User</c>
/// (Identity), <c>Professional</c> (Professional) ou <c>Condominium</c>
/// (Condominium) — só os Ids como valores simples.
///
/// REGRAS CRÍTICAS que dependem de outro módulo ("morador Active pode
/// recomendar", "se o profissional já existir no ALILU, vincular
/// ProfessionalId") são responsabilidade da Api (composição raiz) ANTES de
/// chamar <c>RecommendationService.RecommendAsync</c> — ver
/// <c>RecommendationsController</c> e ARCHITECTURE.md, "Etapa 10 —
/// composição".
///
/// Campos exatamente como o prompt listou: Id, CondominiumId,
/// RecommendedByUserId, ProfessionalId (nullable), ExternalProfessionalName
/// (nullable), ExternalPhone (nullable), ServiceCategoryId, Comment,
/// Status, CreatedAt, ApprovedAt, ApprovedBy — de propósito NÃO há
/// <c>UpdatedAt</c> (mesma decisão de <c>Review</c>, Etapa 09). O prompt
/// marcou só três campos como "nullable" na lista da entidade — por
/// contraste, <see cref="Comment"/> é interpretado como OBRIGATÓRIO
/// (diferente da Etapa 09, onde <c>Review.Comment</c> foi deixado
/// opcional): aqui a indicação É o comentário ("por que confio nesse
/// profissional"), não um complemento opcional de uma nota numérica.
///
/// Indicação interna vs. externa (XOR): exatamente um entre
/// <see cref="ProfessionalId"/> e <see cref="ExternalProfessionalName"/>
/// deve estar preenchido — nunca os dois, nunca nenhum. Ver
/// <see cref="Recommend"/>.
/// </summary>
public sealed class Recommendation : AggregateRoot
{
    public Guid CondominiumId { get; private set; }
    public Guid RecommendedByUserId { get; private set; }
    public Guid? ProfessionalId { get; private set; }
    public string? ExternalProfessionalName { get; private set; }
    public string? ExternalPhone { get; private set; }
    public Guid ServiceCategoryId { get; private set; }
    public string Comment { get; private set; }
    public RecommendationStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public Guid? ApprovedBy { get; private set; }

    public bool IsPending => Status == RecommendationStatus.Pending;

    public bool IsApproved => Status == RecommendationStatus.Approved;

#pragma warning disable CS8618
    private Recommendation()
    {
    }
#pragma warning restore CS8618

    private Recommendation(
        Guid id,
        Guid condominiumId,
        Guid recommendedByUserId,
        Guid? professionalId,
        string? externalProfessionalName,
        string? externalPhone,
        Guid serviceCategoryId,
        string comment)
        : base(id)
    {
        CondominiumId = condominiumId;
        RecommendedByUserId = recommendedByUserId;
        ProfessionalId = professionalId;
        ExternalProfessionalName = externalProfessionalName;
        ExternalPhone = externalPhone;
        ServiceCategoryId = serviceCategoryId;
        Comment = comment;
        Status = RecommendationStatus.Pending;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cria a indicação (React Native: RecommendProfessionalScreen). Todas
    /// as REGRAS CRÍTICAS que dependem de outro módulo ("morador Active",
    /// "profissional já existe no ALILU", "não permitir spam ilimitado")
    /// já devem ter sido validadas por quem chama (a Api/Application) —
    /// esta entidade, isolada, só valida a própria consistência interna.
    /// Nasce sempre <see cref="RecommendationStatus.Pending"/> ("Administrador
    /// pode moderar").
    /// </summary>
    public static Recommendation Recommend(
        Guid condominiumId,
        Guid recommendedByUserId,
        Guid? professionalId,
        string? externalProfessionalName,
        string? externalPhone,
        Guid serviceCategoryId,
        string comment)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("A recomendação precisa de um condomínio válido.");
        }

        if (recommendedByUserId == Guid.Empty)
        {
            throw new DomainException("A recomendação precisa de um morador válido — não é permitida recomendação anônima.");
        }

        if (serviceCategoryId == Guid.Empty)
        {
            throw new DomainException("A recomendação precisa de uma categoria de serviço válida.");
        }

        var trimmedComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (trimmedComment is null)
        {
            throw new DomainException("A recomendação precisa de um comentário — explique por que você confia nesse profissional.");
        }

        if (trimmedComment.Length > 1000)
        {
            throw new DomainException("O comentário não pode ter mais de 1000 caracteres.");
        }

        var trimmedExternalName = string.IsNullOrWhiteSpace(externalProfessionalName) ? null : externalProfessionalName.Trim();
        var trimmedExternalPhone = string.IsNullOrWhiteSpace(externalPhone) ? null : externalPhone.Trim();

        if (professionalId is { } id && id != Guid.Empty)
        {
            if (trimmedExternalName is not null || trimmedExternalPhone is not null)
            {
                throw new DomainException("Uma recomendação vinculada a um profissional do ALILU não pode ter nome/telefone externos.");
            }

            return new Recommendation(
                Guid.NewGuid(),
                condominiumId,
                recommendedByUserId,
                id,
                null,
                null,
                serviceCategoryId,
                trimmedComment);
        }

        if (trimmedExternalName is null)
        {
            throw new DomainException("A recomendação precisa indicar um profissional do ALILU ou o nome de um profissional externo.");
        }

        return new Recommendation(
            Guid.NewGuid(),
            condominiumId,
            recommendedByUserId,
            null,
            trimmedExternalName,
            trimmedExternalPhone,
            serviceCategoryId,
            trimmedComment);
    }

    /// <summary>Administrador aprova a indicação — passa a contar em "Recomendado por N moradores". Só a partir de Pending.</summary>
    public void Approve(Guid approvedByUserId)
    {
        if (!IsPending)
        {
            throw new DomainException("Só é possível aprovar uma recomendação pendente.");
        }

        if (approvedByUserId == Guid.Empty)
        {
            throw new DomainException("A aprovação precisa de um administrador válido.");
        }

        Status = RecommendationStatus.Approved;
        ApprovedAt = DateTime.UtcNow;
        ApprovedBy = approvedByUserId;
    }

    /// <summary>Administrador recusa a indicação. Só a partir de Pending. Sem campo próprio para registrar o autor (mesma decisão de <c>ProfessionalCondominium.Reject</c>), por isso sem parâmetro de ator.</summary>
    public void Reject()
    {
        if (!IsPending)
        {
            throw new DomainException("Só é possível recusar uma recomendação pendente.");
        }

        Status = RecommendationStatus.Rejected;
    }

    /// <summary>Administrador bloqueia uma indicação já aprovada (ex.: denúncia). Só a partir de Approved. Sem campo próprio para registrar o autor, mesmo motivo de <see cref="Reject"/>.</summary>
    public void Block()
    {
        if (!IsApproved)
        {
            throw new DomainException("Só é possível bloquear uma recomendação aprovada.");
        }

        Status = RecommendationStatus.Blocked;
    }
}
