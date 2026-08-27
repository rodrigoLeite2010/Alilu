using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalDirectoryService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalDirectoryService(
    IProfessionalRepository professionalRepository,
    IServiceCategoryRepository serviceCategoryRepository,
    IProfessionalServiceRepository professionalServiceRepository,
    IProfessionalCondominiumRepository professionalCondominiumRepository,
    IProfessionalAvailabilityRepository availabilityRepository,
    IProfessionalAvailabilityExceptionRepository availabilityExceptionRepository) : IProfessionalDirectoryService
{
    public async Task<IReadOnlyList<ServiceCategoryResponse>> ListCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var categories = await serviceCategoryRepository.ListActiveAsync(cancellationToken);
        return categories.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ListProfessionalsAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default)
    {
        var professionals = await professionalRepository.ListActiveAsync(serviceCategoryId, cancellationToken);
        return await ToDirectoryItemsAsync(professionals, cancellationToken);
    }

    public async Task<ProfessionalDirectoryItemResponse?> GetProfessionalProfileAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken);
        if (professional is null || !professional.IsActive)
        {
            return null;
        }

        var items = await ToDirectoryItemsAsync(new[] { professional }, cancellationToken);
        return items.Single();
    }

    public async Task ValidateAttendsCondominiumAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default)
    {
        var links = await professionalCondominiumRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        var attendsCondominium = links.Any(link => link.CondominiumId == condominiumId && link.IsActive);
        if (!attendsCondominium)
        {
            throw new ProfessionalDoesNotAttendCondominiumException();
        }
    }

    public async Task ValidateAvailableAsync(
        Guid professionalId,
        DateOnly date,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken);
        if (professional is null || !professional.IsActive)
        {
            throw new ProfessionalNotFoundException();
        }

        var exceptionsOnDate = await availabilityExceptionRepository.ListByProfessionalIdAndDateAsync(professionalId, date, cancellationToken);

        // "Exceções sobrescrevem a disponibilidade recorrente" (regra
        // herdada da Etapa 07): um bloqueio que colide com a janela pedida
        // sempre vence, mesmo que a agenda recorrente diria disponível.
        var isBlockedByException = exceptionsOnDate.Any(exception =>
            exception.Type == ProfessionalAvailabilityExceptionType.Blocked && exception.OverlapsWith(startTime, endTime));

        if (isBlockedByException)
        {
            throw new TimeSlotUnavailableException();
        }

        // Uma liberação pontual que cubra a janela inteira também vence,
        // independente da agenda recorrente (ex.: abrir um horário numa
        // quarta normalmente indisponível — exemplo do próprio PROMPT 07).
        var isOpenedByException = exceptionsOnDate.Any(exception =>
            exception.Type == ProfessionalAvailabilityExceptionType.Available && FullyContains(exception, startTime, endTime));

        if (isOpenedByException)
        {
            return;
        }

        var weeklySchedule = await availabilityRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        var isWithinRecurringSchedule = weeklySchedule.Any(slot =>
            slot.Active && slot.DayOfWeek == date.DayOfWeek && slot.StartTime <= startTime && endTime <= slot.EndTime);

        if (!isWithinRecurringSchedule)
        {
            throw new TimeSlotUnavailableException();
        }
    }

    public async Task<IReadOnlyList<OpenTimeWindowResponse>> ListOpenWindowsAsync(
        Guid professionalId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken);
        if (professional is null || !professional.IsActive)
        {
            throw new ProfessionalNotFoundException();
        }

        var exceptionsOnDate = await availabilityExceptionRepository.ListByProfessionalIdAndDateAsync(professionalId, date, cancellationToken);

        // Mesma regra de ValidateAvailableAsync: um bloqueio do dia inteiro
        // fecha tudo, não importa a agenda recorrente.
        if (exceptionsOnDate.Any(exception => exception.Type == ProfessionalAvailabilityExceptionType.Blocked && exception.IsFullDay))
        {
            return Array.Empty<OpenTimeWindowResponse>();
        }

        var weeklySchedule = await availabilityRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        var windows = weeklySchedule
            .Where(slot => slot.Active && slot.DayOfWeek == date.DayOfWeek)
            .Select(slot => (Start: slot.StartTime, End: slot.EndTime))
            .ToList();

        // Bloqueios pontuais recortam (ou removem) janelas da agenda recorrente.
        foreach (var blocked in exceptionsOnDate.Where(exception => exception.Type == ProfessionalAvailabilityExceptionType.Blocked && !exception.IsFullDay))
        {
            windows = Subtract(windows, blocked.StartTime!.Value, blocked.EndTime!.Value);
        }

        // Liberações pontuais somam janelas extras (ex.: abrir um horário
        // numa quarta normalmente indisponível — exemplo do PROMPT 07),
        // mesmo por cima da agenda recorrente; dia inteiro liberado vira uma
        // única janela cobrindo o dia todo.
        foreach (var opened in exceptionsOnDate.Where(exception => exception.Type == ProfessionalAvailabilityExceptionType.Available))
        {
            windows.Add(opened.IsFullDay ? (TimeOnly.MinValue, TimeOnly.MaxValue) : (opened.StartTime!.Value, opened.EndTime!.Value));
        }

        return MergeAndSort(windows).Select(window => new OpenTimeWindowResponse(window.Start, window.End)).ToList();
    }

    /// <summary>Remove [<paramref name="blockStart"/>, <paramref name="blockEnd"/>) de cada janela, recortando ou removendo quem colide (uma janela pode virar duas, se o bloqueio cair no meio dela).</summary>
    private static List<(TimeOnly Start, TimeOnly End)> Subtract(List<(TimeOnly Start, TimeOnly End)> windows, TimeOnly blockStart, TimeOnly blockEnd)
    {
        var result = new List<(TimeOnly Start, TimeOnly End)>();

        foreach (var (start, end) in windows)
        {
            if (blockEnd <= start || blockStart >= end)
            {
                result.Add((start, end));
                continue;
            }

            if (blockStart > start)
            {
                result.Add((start, blockStart));
            }

            if (blockEnd < end)
            {
                result.Add((blockEnd, end));
            }
        }

        return result;
    }

    /// <summary>Ordena por início e funde janelas sobrepostas/adjacentes (pode acontecer quando uma liberação pontual soma em cima de um trecho já recorrente) — devolve uma lista "limpa", sem sobreposição, pronta para exibição.</summary>
    private static List<(TimeOnly Start, TimeOnly End)> MergeAndSort(List<(TimeOnly Start, TimeOnly End)> windows)
    {
        if (windows.Count == 0)
        {
            return windows;
        }

        var sorted = windows.OrderBy(window => window.Start).ToList();
        var merged = new List<(TimeOnly Start, TimeOnly End)> { sorted[0] };

        foreach (var current in sorted.Skip(1))
        {
            var last = merged[^1];
            if (current.Start <= last.End)
            {
                merged[^1] = (last.Start, current.End > last.End ? current.End : last.End);
            }
            else
            {
                merged.Add(current);
            }
        }

        return merged;
    }

    public async Task<Guid> GetProfessionalUserIdAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken);
        if (professional is null || !professional.IsActive)
        {
            throw new ProfessionalNotFoundException();
        }

        return professional.UserId;
    }

    /// <summary>A janela pedida cabe inteira dentro da exceção (dia inteiro sempre cabe; janela parcial precisa conter [startTime, endTime) por completo — uma liberação parcial menor que o pedido não é suficiente).</summary>
    private static bool FullyContains(ProfessionalAvailabilityException exception, TimeOnly startTime, TimeOnly endTime) =>
        exception.IsFullDay || (exception.StartTime!.Value <= startTime && endTime <= exception.EndTime!.Value);

    private async Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ToDirectoryItemsAsync(
        IReadOnlyList<Domain.Professional> professionals,
        CancellationToken cancellationToken)
    {
        if (professionals.Count == 0)
        {
            return Array.Empty<ProfessionalDirectoryItemResponse>();
        }

        var professionalIds = professionals.Select(p => p.Id).ToList();
        var activeServices = await professionalServiceRepository.ListActiveByProfessionalIdsAsync(professionalIds, cancellationToken);

        var categoryIds = activeServices.Select(s => s.ServiceCategoryId).Distinct().ToList();
        var categories = (await serviceCategoryRepository.ListAsync(cancellationToken))
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        return professionals
            .Select(professional =>
            {
                var categoriesForProfessional = activeServices
                    .Where(s => s.ProfessionalId == professional.Id)
                    .Select(s => categories.GetValueOrDefault(s.ServiceCategoryId))
                    .Where(c => c is not null)
                    .Select(c => c!);

                return ProfessionalMapper.ToDirectoryItem(professional, categoriesForProfessional);
            })
            .ToList();
    }
}
