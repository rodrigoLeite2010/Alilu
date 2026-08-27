using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalDirectoryService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalDirectoryService(
    IProfessionalRepository professionalRepository,
    IServiceCategoryRepository serviceCategoryRepository,
    IProfessionalCategoryRepository professionalCategoryRepository,
    IProfessionalServiceRepository professionalServiceRepository,
    IProfessionalCondominiumRepository professionalCondominiumRepository,
    IProfessionalAvailabilityRepository availabilityRepository,
    IProfessionalAvailabilityExceptionRepository availabilityExceptionRepository) : IProfessionalDirectoryService
{
    public async Task<IReadOnlyList<ProfessionalCategoryResponse>> ListProfessionalCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var categories = await professionalCategoryRepository.ListActiveAsync(cancellationToken);
        return categories.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<ServiceCategoryResponse>> ListCategoriesAsync(Guid? categoryId = null, CancellationToken cancellationToken = default)
    {
        var categories = await serviceCategoryRepository.ListActiveAsync(categoryId, cancellationToken);
        return categories.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ListProfessionalsAsync(
        Guid? serviceCategoryId,
        Guid? professionalCategoryId = null,
        string? name = null,
        CancellationToken cancellationToken = default)
    {
        var professionals = await professionalRepository.ListActiveAsync(serviceCategoryId, professionalCategoryId, name, cancellationToken);
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
        var weeklySchedule = await availabilityRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        // Etapa 19 — BUG REAL encontrado testando o cadastro em massa: esta
        // validação costumava exigir que [startTime, endTime) coubesse
        // inteiro dentro de UM ÚNICO intervalo recorrente, mas
        // `ListOpenWindowsAsync`/`OpenWindowResolver` (a mesma tela que
        // mostra ao morador o que está livre) já FUNDE intervalos adjacentes
        // (ex.: "Manhã" 07:00-12:00 + "Tarde" 12:00-18:00, criados juntos
        // por `SetBulkAvailabilityAsync`) num único bloco visível
        // "07:00-18:00". Resultado: o morador via/escolhia um horário que a
        // Api recusava em seguida, porque nem o intervalo de Manhã nem o de
        // Tarde, sozinho, cobre as 07:00-18:00 inteiras. Agora esta
        // validação usa o MESMO `OpenWindowResolver` (bloqueios recortando,
        // liberações somando, dia inteiro bloqueando tudo) que já resolve
        // as janelas exibidas — os dois nunca mais podem divergir, porque é
        // literalmente o mesmo código.
        var (openWindows, _) = OpenWindowResolver.Resolve(date, weeklySchedule, exceptionsOnDate);

        var isWithinAnOpenWindow = openWindows.Any(window => window.Start <= startTime && endTime <= window.End);
        if (!isWithinAnOpenWindow)
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
        var weeklySchedule = await availabilityRepository.ListByProfessionalIdAsync(professionalId, cancellationToken);

        // Algoritmo compartilhado com o self-service "Minha Agenda" (Etapa
        // 19) — ver OpenWindowResolver para o porquê da extração.
        var (open, _) = OpenWindowResolver.Resolve(date, weeklySchedule, exceptionsOnDate);
        return open.Select(window => new OpenTimeWindowResponse(window.Start, window.End)).ToList();
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
