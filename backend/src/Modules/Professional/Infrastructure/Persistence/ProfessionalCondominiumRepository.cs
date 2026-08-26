using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IProfessionalCondominiumRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ProfessionalCondominiumRepository(AliluDbContext dbContext) : IProfessionalCondominiumRepository
{
    public Task<ProfessionalCondominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalCondominium>()
            .FirstOrDefaultAsync(pc => pc.Id == id, cancellationToken);

    public async Task<IReadOnlyList<ProfessionalCondominium>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCondominium>()
            .Where(pc => pc.ProfessionalId == professionalId)
            .OrderByDescending(pc => pc.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsActiveOrPendingAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default) =>
        dbContext.Set<ProfessionalCondominium>()
            .AnyAsync(
                pc => pc.ProfessionalId == professionalId
                    && pc.CondominiumId == condominiumId
                    && (pc.Status == ProfessionalCondominiumStatus.Pending || pc.Status == ProfessionalCondominiumStatus.Active),
                cancellationToken);

    public async Task<IReadOnlyList<ProfessionalCondominium>> ListPendingAsync(Guid? condominiumId = null, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCondominium>()
            .Where(pc => pc.Status == ProfessionalCondominiumStatus.Pending && (condominiumId == null || pc.CondominiumId == condominiumId))
            .OrderBy(pc => pc.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ProfessionalCondominium>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCondominium>()
            .Where(pc => pc.CondominiumId == condominiumId)
            .OrderByDescending(pc => pc.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ProfessionalCondominium professionalCondominium, CancellationToken cancellationToken = default) =>
        await dbContext.Set<ProfessionalCondominium>().AddAsync(professionalCondominium, cancellationToken);
}
