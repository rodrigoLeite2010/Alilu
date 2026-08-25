using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalAvailabilityExceptionRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalAvailabilityExceptionRepository(AliluDbContext dbContext) : IProfessionalAvailabilityExceptionRepository
{
    public Task<ProfessionalAvailabilityException?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalAvailabilityException>()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalAvailabilityException>()
            .Where(e => e.ProfessionalId == professionalId)
            .OrderBy(e => e.Date)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAndDateAsync(Guid professionalId, DateOnly date, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalAvailabilityException>()
            .Where(e => e.ProfessionalId == professionalId && e.Date == date)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalAvailabilityException>().AddAsync(exception, cancellationToken);

    public Task RemoveAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default)
    {
        dbContext.Set<ProfessionalAvailabilityException>().Remove(exception);
        return Task.CompletedTask;
    }
}
