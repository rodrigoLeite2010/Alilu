using Alilu.Modules.Mural.Domain;

namespace Alilu.Modules.Mural.Application;

/// <summary>Conversão Domain → DTO deste módulo — mesmo papel de <c>RecommendationMapper</c>/<c>ReviewMapper</c> nos demais módulos.</summary>
internal static class MuralMapper
{
    public static MuralPostResponse ToResponse(MuralPost post) => new(
        post.Id,
        post.CondominiumId,
        post.AuthorUserId,
        post.Type,
        post.Content,
        post.Status,
        post.CreatedAt,
        post.BlockedAt,
        post.BlockedBy);
}
