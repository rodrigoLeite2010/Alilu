using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Recommendations.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Recommendations.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IRecommendationRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class RecommendationRepository(AliluDbContext dbContext) : IRecommendationRepository
{
    public Task<Recommendation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Recommendation>().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Recommendation>> ListByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Recommendation>()
            .Where(r => r.RecommendedByUserId == recommendedByUserId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<int> CountPendingByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Recommendation>()
            .CountAsync(r => r.RecommendedByUserId == recommendedByUserId && r.Status == RecommendationStatus.Pending, cancellationToken);

    public async Task<IReadOnlyList<Recommendation>> ListApprovedByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Recommendation>()
            .Where(r => r.ProfessionalId == professionalId && r.Status == RecommendationStatus.Approved)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Recommendation>> ListPendingAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Set<Recommendation>()
            .Where(r => r.Status == RecommendationStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Recommendation recommendation, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Recommendation>().AddAsync(recommendation, cancellationToken);
}
