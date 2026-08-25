using Alilu.Modules.Resident.Domain;

namespace Alilu.Modules.Resident.Application;

/// <summary>Mapeamento Entidade → DTO compartilhado por <see cref="MembershipService"/> e <see cref="MembershipAdministrationService"/>.</summary>
internal static class MembershipMapper
{
    public static MembershipResponse ToResponse(CondominiumMembership membership) => new(
        membership.Id,
        membership.UserId,
        membership.CondominiumId,
        membership.UnitId,
        membership.Status,
        membership.ValidatedAt,
        membership.ValidatedBy,
        membership.CreatedAt,
        membership.UpdatedAt);
}
