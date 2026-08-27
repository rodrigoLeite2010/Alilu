using Alilu.Shared;

namespace Alilu.Modules.Mural.Domain;

/// <summary>
/// Etapa 23 (pedido 3 de Rodrigo: "ter uma opcao de Mural, onde e texto
/// aberto por morador, reclamacoes, sugestoes, falar de algum prestador
/// nao cadastrado negativar e avisar por quaisquer problemas") — mural
/// aberto do condomínio: qualquer morador com vínculo Active pode publicar
/// texto livre, sem aprovação prévia (ver <see cref="MuralPostStatus"/>
/// para a decisão de moderação pós-hoc).
///
/// É sua própria raiz de agregado — mesma decisão de todos os módulos
/// anteriores: de propósito NÃO há navegação/FK para <c>User</c>
/// (Identity) nem <c>Condominium</c> (Condominium), só os Ids como valores
/// simples. "Morador Active pode publicar" (regra que depende do módulo
/// Resident) é responsabilidade da Api (composição raiz) ANTES de chamar
/// <see cref="Post"/> — ver <c>MuralController</c> e o mesmo raciocínio já
/// documentado em <c>RecommendationsController</c> (Etapa 10).
/// </summary>
public sealed class MuralPost : AggregateRoot
{
    /// <summary>Limite de caracteres do texto livre — mesmo valor usado por <c>Recommendation.Comment</c> (Etapa 10) e <c>Review.Comment</c> (Etapa 09), por consistência entre os módulos de conteúdo gerado por morador.</summary>
    public const int MaxContentLength = 1000;

    public Guid CondominiumId { get; private set; }
    public Guid AuthorUserId { get; private set; }
    public MuralPostType Type { get; private set; }
    public string Content { get; private set; }
    public MuralPostStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? BlockedAt { get; private set; }
    public Guid? BlockedBy { get; private set; }

    public bool IsVisible => Status == MuralPostStatus.Visible;

    public bool IsBlocked => Status == MuralPostStatus.Blocked;

#pragma warning disable CS8618
    private MuralPost()
    {
    }
#pragma warning restore CS8618

    private MuralPost(
        Guid id,
        Guid condominiumId,
        Guid authorUserId,
        MuralPostType type,
        string content)
        : base(id)
    {
        CondominiumId = condominiumId;
        AuthorUserId = authorUserId;
        Type = type;
        Content = content;
        Status = MuralPostStatus.Visible;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cria o post (React Native: novo post no Mural). Nasce sempre
    /// <see cref="MuralPostStatus.Visible"/> — diferente de
    /// <c>Recommendation.Recommend</c> (Etapa 10), que nasce Pending; a
    /// moderação aqui é só pós-hoc (ver <see cref="MuralPostStatus"/>).
    /// "Morador Active pode publicar" já deve ter sido validado por quem
    /// chama (a Api/Application) — esta entidade, isolada, só valida a
    /// própria consistência interna.
    /// </summary>
    public static MuralPost Post(
        Guid condominiumId,
        Guid authorUserId,
        MuralPostType type,
        string content)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O post do mural precisa de um condomínio válido.");
        }

        if (authorUserId == Guid.Empty)
        {
            throw new DomainException("O post do mural precisa de um autor válido — não é permitido post anônimo.");
        }

        if (!Enum.IsDefined(typeof(MuralPostType), type))
        {
            throw new DomainException("Tipo de post do mural inválido.");
        }

        var trimmedContent = string.IsNullOrWhiteSpace(content) ? null : content.Trim();
        if (trimmedContent is null)
        {
            throw new DomainException("O post do mural precisa de um texto.");
        }

        if (trimmedContent.Length > MaxContentLength)
        {
            throw new DomainException($"O texto do post não pode ter mais de {MaxContentLength} caracteres.");
        }

        return new MuralPost(Guid.NewGuid(), condominiumId, authorUserId, type, trimmedContent);
    }

    /// <summary>Administrador (síndico/SuperAdmin) bloqueia o post (ex.: denúncia, conteúdo inadequado). Só a partir de Visible — mesma decisão de <c>Recommendation.Block</c> (Etapa 10), que também só aceita um único bloqueio.</summary>
    public void Block(Guid blockedByUserId)
    {
        if (!IsVisible)
        {
            throw new DomainException("Este post já está bloqueado.");
        }

        if (blockedByUserId == Guid.Empty)
        {
            throw new DomainException("O bloqueio precisa de um administrador válido.");
        }

        Status = MuralPostStatus.Blocked;
        BlockedAt = DateTime.UtcNow;
        BlockedBy = blockedByUserId;
    }
}
