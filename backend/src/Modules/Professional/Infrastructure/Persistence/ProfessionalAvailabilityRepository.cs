using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalAvailabilityRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalAvailabilityRepository(AliluDbContext dbContext) : IProfessionalAvailabilityRepository
{
    public Task<ProfessionalAvailability?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalAvailability>()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalAvailability>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalAvailability>()
            .Where(a => a.ProfessionalId == professionalId)
            .OrderBy(a => a.DayOfWeek).ThenBy(a => a.StartTime)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ProfessionalAvailability availability, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalAvailability>().AddAsync(availability, cancellationToken);
}
