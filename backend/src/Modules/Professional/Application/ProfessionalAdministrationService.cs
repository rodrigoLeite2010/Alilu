namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalAdministrationService(
    IProfessionalCondominiumRepository professionalCondominiumRepository,
    IUnitOfWork unitOfWork) : IProfessionalAdministrationService
{
    public async Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListPendingCondominiumRequestsAsync(
        ProfessionalRequesterRole requesterRole,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var pending = await professionalCondominiumRepository.ListPendingAsync(cancellationToken);
        return pending.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<ProfessionalCondominiumResponse> ApproveCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var professionalCondominium = await professionalCondominiumRepository.GetByIdAsync(professionalCondominiumId, cancellationToken)
            ?? throw new ProfessionalCondominiumNotFoundException();

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
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var professionalCondominium = await professionalCondominiumRepository.GetByIdAsync(professionalCondominiumId, cancellationToken)
            ?? throw new ProfessionalCondominiumNotFoundException();

        if (!professionalCondominium.IsPending)
        {
            throw new ProfessionalCondominiumNotPendingException();
        }

        professionalCondominium.Reject();
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
}
