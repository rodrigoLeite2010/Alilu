using Alilu.Modules.Administration.Domain;

namespace Alilu.Modules.Administration.Application;

/// <summary>Implementação de <see cref="IAdminScopeService"/> — ver comentário de design lá.</summary>
public sealed class AdminScopeService(
    ICondominiumAdministratorRepository repository,
    IUnitOfWork unitOfWork) : IAdminScopeService
{
    public async Task<AdminScope> ResolveScopeAsync(
        AdministrationRequesterRole requesterRole,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (requesterRole == AdministrationRequesterRole.SuperAdmin)
        {
            return new AdminScope(userId, null);
        }

        if (requesterRole != AdministrationRequesterRole.CondominiumAdmin)
        {
            throw new InsufficientPermissionsException();
        }

        var assignment = await repository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new AdminNotAssignedToCondominiumException();

        return new AdminScope(userId, assignment.CondominiumId);
    }

    public async Task<CondominiumAdministratorResponse> AssignAsync(
        AdministrationRequesterRole requesterRole,
        Guid targetUserId,
        Guid condominiumId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsSuperAdmin(requesterRole);

        var existing = await repository.GetByUserIdAsync(targetUserId, cancellationToken);
        if (existing is not null)
        {
            existing.Reassign(condominiumId);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return ToResponse(existing);
        }

        var administrator = CondominiumAdministrator.Assign(targetUserId, condominiumId);
        await repository.AddAsync(administrator, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(administrator);
    }

    public async Task<IReadOnlyList<CondominiumAdministratorResponse>> ListAssignmentsAsync(
        AdministrationRequesterRole requesterRole,
        CancellationToken cancellationToken = default)
    {
        EnsureIsSuperAdmin(requesterRole);

        var assignments = await repository.ListAsync(cancellationToken);
        return assignments.Select(ToResponse).ToList();
    }

    private static void EnsureIsSuperAdmin(AdministrationRequesterRole requesterRole)
    {
        if (requesterRole != AdministrationRequesterRole.SuperAdmin)
        {
            throw new InsufficientPermissionsException();
        }
    }

    private static CondominiumAdministratorResponse ToResponse(CondominiumAdministrator administrator) =>
        new(administrator.Id, administrator.UserId, administrator.CondominiumId, administrator.CreatedAt, administrator.UpdatedAt);
}
