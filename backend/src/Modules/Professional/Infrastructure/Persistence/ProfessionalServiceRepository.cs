using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalServiceRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalServiceRepository(AliluDbContext dbContext) : IProfessionalServiceRepository
{
    public Task<ProfessionalService?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalService>()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalService>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalService>()
            .Where(s => s.ProfessionalId == professionalId)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ProfessionalService>> ListActiveByProfessionalIdsAsync(IReadOnlyCollection<Guid> professionalIds, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalService>()
            .Where(s => s.Active && professionalIds.Contains(s.ProfessionalId))
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsActiveAsync(Guid professionalId, Guid serviceCategoryId, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalService>()
            .AnyAsync(s => s.ProfessionalId == professionalId && s.ServiceCategoryId == serviceCategoryId && s.Active, cancellationToken);

    public async Task AddAsync(ProfessionalService professionalService, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalService>().AddAsync(professionalService, cancellationToken);
}
