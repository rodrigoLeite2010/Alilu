using Alilu.Modules.Mural.Domain;

namespace Alilu.Modules.Mural.Application;

/// <summary>
/// Nunca inclui dados de outro módulo (nome do morador) — só os Ids,
/// exatamente como a entidade os guarda. Enriquecer para exibição
/// (ex.: nome do autor) é responsabilidade da Api — mesma decisão de
/// <c>RecommendationResponse</c> (Recommendations) e demais módulos.
/// </summary>
public sealed record MuralPostResponse(
    Guid Id,
    Guid CondominiumId,
    Guid AuthorUserId,
    MuralPostType Type,
    string Content,
    MuralPostStatus Status,
    DateTime CreatedAt,
    DateTime? BlockedAt,
    Guid? BlockedBy);
