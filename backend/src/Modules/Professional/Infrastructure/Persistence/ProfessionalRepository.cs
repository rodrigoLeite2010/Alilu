using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IProfessionalRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class ProfessionalRepository(AliluDbContext dbContext) : IProfessionalRepository
{
    public Task<Domain.Professional?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Professional>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public Task<Domain.Professional?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Professional>()
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    public async Task<IReadOnlyList<Domain.Professional>> ListActiveAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<Domain.Professional>().Where(p => p.Status == ProfessionalStatus.Active);

        if (serviceCategoryId is { } categoryId)
        {
            var professionalIdsWithCategory = dbContext.Set<ProfessionalService>()
                .Where(s => s.Active && s.ServiceCategoryId == categoryId)
                .Select(s => s.ProfessionalId);

            query = query.Where(p => professionalIdsWithCategory.Contains(p.Id));
        }

        return await query.OrderBy(p => p.DisplayName).ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Domain.Professional professional, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Domain.Professional>().AddAsync(professional, cancellationToken);
}
