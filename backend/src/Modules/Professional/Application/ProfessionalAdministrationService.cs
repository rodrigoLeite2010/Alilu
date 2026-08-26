using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalAdministrationService(
    IProfessionalRepository professionalRepository,
    IProfessionalCondominiumRepository professionalCondominiumRepository,
    IUnitOfWork unitOfWork) : IProfessionalAdministrationService
{
    public async Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListPendingCondominiumRequestsAsync(
        ProfessionalRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await professionalCondominiumRepository.ListPendingAsync(scopeCondominiumId, cancellationToken);
        return pending.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListByCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);
        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var associations = await professionalCondominiumRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return associations.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<ProfessionalCondominiumResponse> ApproveCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var professionalCondominium = await professionalCondominiumRepository.GetByIdAsync(professionalCondominiumId, cancellationToken)
            ?? throw new ProfessionalCondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, professionalCondominium.CondominiumId);

        if (!professionalCondominium.IsPending)
        {
            throw new ProfessionalCondominiumNotPendingException();
        }

        professionalCondominium.Approve();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professionalCondominium);
    }

    public async Task<ProfessionalCondominiumResponse> RejectCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var professionalCondominium = await professionalCondominiumRepository.GetByIdAsync(professionalCondominiumId, cancellationToken)
            ?? throw new ProfessionalCondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, professionalCondominium.CondominiumId);

        if (!professionalCondominium.IsPending)
        {
            throw new ProfessionalCondominiumNotPendingException();
        }

        professionalCondominium.Reject();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professionalCondominium);
    }

    public async Task<ProfessionalCondominiumResponse> BlockAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var professionalCondominium = await professionalCondominiumRepository.GetByIdAsync(professionalCondominiumId, cancellationToken)
            ?? throw new ProfessionalCondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, professionalCondominium.CondominiumId);

        professionalCondominium.Deactivate();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professionalCondominium);
    }

    public async Task<ProfessionalCondominiumResponse> AssociateAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalId,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);
        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken)
            ?? throw new ProfessionalNotFoundException();

        if (await professionalCondominiumRepository.ExistsActiveOrPendingAsync(professional.Id, condominiumId, cancellationToken))
        {
            throw new DuplicateProfessionalCondominiumException();
        }

        var professionalCondominium = ProfessionalCondominium.CreateActive(professional.Id, condominiumId, ProfessionalCondominiumSource.AdminApproved);

        await professionalCondominiumRepository.AddAsync(professionalCondominium, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professionalCondominium);
    }

    private static void EnsureIsAdmin(ProfessionalRequesterRole requesterRole)
    {
        if (requesterRole is not (ProfessionalRequesterRole.CondominiumAdmin or ProfessionalRequesterRole.SuperAdmin))
        {
            throw new InsufficientPermissionsException();
        }
    }

    /// <summary>
    /// "CondominiumAdmin somente pode administrar seu próprio condomínio"
    /// (PROMPT 12) — <paramref name="scopeCondominiumId"/> nulo (SuperAdmin)
    /// sempre passa; não-nulo só passa se igual a
    /// <paramref name="targetCondominiumId"/>. Resolvido pela Api via
    /// <c>Administration.IAdminScopeService</c> antes de chamar este módulo.
    /// </summary>
    private static void EnsureScopeMatches(Guid? scopeCondominiumId, Guid targetCondominiumId)
    {
        if (scopeCondominiumId is not null && scopeCondominiumId.Value != targetCondominiumId)
        {
            throw new InsufficientPermissionsException();
        }
    }
}
