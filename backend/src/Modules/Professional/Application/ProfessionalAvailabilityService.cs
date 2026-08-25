using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalAvailabilityService"/> — ver comentário de design/segurança em <see cref="ProfessionalProfileService"/>, mesmo padrão aqui.</summary>
public sealed class ProfessionalAvailabilityService(
    IProfessionalRepository professionalRepository,
    IProfessionalAvailabilityRepository availabilityRepository,
    IProfessionalAvailabilityExceptionRepository exceptionRepository,
    IUnitOfWork unitOfWork) : IProfessionalAvailabilityService
{
    public async Task<ProfessionalAvailabilityOverviewResponse> GetMyAvailabilityAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var schedule = await availabilityRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);
        var exceptions = await exceptionRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);

        return new ProfessionalAvailabilityOverviewResponse(
            schedule.Select(ProfessionalMapper.ToResponse).ToList(),
            exceptions.Select(ProfessionalMapper.ToResponse).ToList());
    }

    public async Task<ProfessionalAvailabilityResponse> AddAvailabilityAsync(
        Guid userId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        await EnsureNoOverlapAsync(professional.Id, dayOfWeek, startTime, endTime, excludeId: null, cancellationToken);

        var availability = ProfessionalAvailability.Create(professional.Id, dayOfWeek, startTime, endTime);

        await availabilityRepository.AddAsync(availability, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(availability);
    }

    public async Task<ProfessionalAvailabilityResponse> UpdateAvailabilityAsync(
        Guid userId,
        Guid availabilityId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);
        var availability = await GetOwnAvailabilityOrThrowAsync(professional.Id, availabilityId, cancellationToken);

        await EnsureNoOverlapAsync(professional.Id, dayOfWeek, startTime, endTime, excludeId: availability.Id, cancellationToken);

        availability.Reschedule(dayOfWeek, startTime, endTime);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(availability);
    }

    public async Task RemoveAvailabilityAsync(Guid userId, Guid availabilityId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);
        var availability = await GetOwnAvailabilityOrThrowAsync(professional.Id, availabilityId, cancellationToken);

        availability.Deactivate();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<ProfessionalAvailabilityExceptionResponse> AddExceptionAsync(
        Guid userId,
        DateOnly date,
        TimeOnly? startTime,
        TimeOnly? endTime,
        ProfessionalAvailabilityExceptionType type,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var sameDate = await exceptionRepository.ListByProfessionalIdAndDateAsync(professional.Id, date, cancellationToken);
        if (sameDate.Any(existing => existing.OverlapsWith(startTime, endTime)))
        {
            throw new OverlappingAvailabilityException();
        }

        var exception = ProfessionalAvailabilityException.Create(professional.Id, date, startTime, endTime, type, reason);

        await exceptionRepository.AddAsync(exception, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(exception);
    }

    public async Task RemoveExceptionAsync(Guid userId, Guid exceptionId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var exception = await exceptionRepository.GetByIdAsync(exceptionId, cancellationToken)
            ?? throw new ProfessionalAvailabilityExceptionNotFoundException();

        // Segunda camada de defesa: uma exceção só pode ser removida pelo
        // próprio dono do perfil — mesmo padrão de
        // ProfessionalProfileService.RemoveMyServiceAsync.
        if (exception.ProfessionalId != professional.Id)
        {
            throw new ProfessionalAvailabilityExceptionNotFoundException();
        }

        await exceptionRepository.RemoveAsync(exception, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// "Não permitir horários sobrepostos" (PROMPT 07) — carrega todos os
    /// intervalos do profissional e compara em memória (volume esperado por
    /// profissional é baixo: no máximo alguns intervalos por dia da
    /// semana), ignorando os inativos e, numa edição, o próprio intervalo
    /// sendo editado (<paramref name="excludeId"/>).
    /// </summary>
    private async Task EnsureNoOverlapAsync(
        Guid professionalId,
        DayOfWeek dayOfWeek,
        TimeOnly startTime,
        TimeOnly endTime,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        var existing = await availabilityRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        var overlaps = existing.Any(slot =>
            slot.Active
            && slot.Id != excludeId
            && slot.OverlapsWith(dayOfWeek, startTime, endTime));

        if (overlaps)
        {
            throw new OverlappingAvailabilityException();
        }
    }

    private async Task<Domain.Professional> GetOwnProfileOrThrowAsync(Guid userId, CancellationToken cancellationToken) =>
        await professionalRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new ProfessionalNotFoundException();

    private async Task<ProfessionalAvailability> GetOwnAvailabilityOrThrowAsync(Guid professionalId, Guid availabilityId, CancellationToken cancellationToken)
    {
        var availability = await availabilityRepository.GetByIdAsync(availabilityId, cancellationToken)
            ?? throw new ProfessionalAvailabilityNotFoundException();

        // Segunda camada de defesa: um intervalo só pode ser editado/
        // removido pelo próprio dono do perfil — mesmo padrão de
        // ProfessionalProfileService.RemoveMyServiceAsync.
        if (availability.ProfessionalId != professionalId)
        {
            throw new ProfessionalAvailabilityNotFoundException();
        }

        return availability;
    }
}
