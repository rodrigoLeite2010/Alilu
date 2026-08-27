using Alilu.Modules.Professional.Domain;
using Alilu.Shared;

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

    /// <summary>Ver comentário completo em <see cref="IProfessionalAvailabilityService.SetBulkAvailabilityAsync"/>.</summary>
    public async Task<IReadOnlyList<ProfessionalAvailabilityResponse>> SetBulkAvailabilityAsync(
        Guid userId,
        IReadOnlyList<DayOfWeek> daysOfWeek,
        IReadOnlyList<AvailabilityPeriodInput> periods,
        DateOnly? effectiveFrom,
        DateOnly? effectiveUntil,
        CancellationToken cancellationToken = default)
    {
        var distinctDays = daysOfWeek.Distinct().ToList();
        if (distinctDays.Count == 0)
        {
            throw new DomainException("Selecione ao menos um dia da semana.");
        }

        if (periods.Count == 0)
        {
            throw new DomainException("Selecione ao menos um período.");
        }

        if (effectiveFrom is not null && effectiveUntil is not null && effectiveFrom.Value > effectiveUntil.Value)
        {
            throw new DomainException("A data final precisa ser igual ou depois da data inicial.");
        }

        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);
        var existing = (await availabilityRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken))
            .Where(slot => slot.Active)
            .ToList();

        var created = new List<ProfessionalAvailability>();

        // Tudo-ou-nada (ver comentário da interface): a checagem de
        // sobreposição olha tanto os intervalos já salvos quanto os que
        // este mesmo pedido acabou de "criar" em memória (`existing` cresce
        // a cada iteração) — assim duas combinações do MESMO pedido também
        // não podem colidir entre si (ex.: pedir "Manhã" duas vezes para a
        // Segunda por engano).
        foreach (var dayOfWeek in distinctDays)
        {
            foreach (var period in periods)
            {
                var conflicts = existing.Any(slot => slot.OverlapsWith(dayOfWeek, period.StartTime, period.EndTime, effectiveFrom, effectiveUntil));
                if (conflicts)
                {
                    throw new OverlappingAvailabilityException();
                }

                var availability = ProfessionalAvailability.Create(
                    professional.Id, dayOfWeek, period.StartTime, period.EndTime, effectiveFrom, effectiveUntil);

                await availabilityRepository.AddAsync(availability, cancellationToken);
                created.Add(availability);
                existing.Add(availability);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return created.Select(ProfessionalMapper.ToResponse).ToList();
    }

    /// <summary>Ver comentário completo em <see cref="IProfessionalAvailabilityService.GetMyOpenWindowsRangeAsync"/>.</summary>
    public async Task<IReadOnlyList<DailyOpenWindowsResponse>> GetMyOpenWindowsRangeAsync(
        Guid userId,
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken = default)
    {
        if (to < from)
        {
            throw new DomainException("A data final precisa ser igual ou depois da data inicial.");
        }

        if (to.DayNumber - from.DayNumber > 62)
        {
            throw new DomainException("Intervalo muito longo — no máximo 62 dias.");
        }

        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);
        var weeklySchedule = await availabilityRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);
        var allExceptions = await exceptionRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);

        var result = new List<DailyOpenWindowsResponse>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var exceptionsOnDate = allExceptions.Where(exception => exception.Date == date).ToList();
            var (open, blocked) = OpenWindowResolver.Resolve(date, weeklySchedule, exceptionsOnDate);

            result.Add(new DailyOpenWindowsResponse(
                date,
                open.Select(window => new OpenTimeWindowResponse(window.Start, window.End)).ToList(),
                blocked.Select(window => new BlockedTimeWindowResponse(window.Start, window.End, window.Reason)).ToList()));
        }

        return result;
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
