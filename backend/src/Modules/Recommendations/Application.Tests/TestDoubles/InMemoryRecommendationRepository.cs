using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Recommendations.Domain;

namespace Alilu.Modules.Recommendations.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IRecommendationRepository"/>.</summary>
public sealed class InMemoryRecommendationRepository : IRecommendationRepository
{
    private readonly Dictionary<Guid, Recommendation> _recommendations = new();

    public Task<Recommendation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_recommendations.GetValueOrDefault(id));

    public Task<IReadOnlyList<Recommendation>> ListByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Recommendation>>(
            _recommendations.Values.Where(r => r.RecommendedByUserId == recommendedByUserId).OrderByDescending(r => r.CreatedAt).ToList());

    public Task<int> CountPendingByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult(
            _recommendations.Values.Count(r => r.RecommendedByUserId == recommendedByUserId && r.Status == RecommendationStatus.Pending));

    public Task<IReadOnlyList<Recommendation>> ListApprovedByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Recommendation>>(
            _recommendations.Values
                .Where(r => r.ProfessionalId == professionalId && r.Status == RecommendationStatus.Approved)
                .OrderByDescending(r => r.CreatedAt)
                .ToList());

    public Task<IReadOnlyList<Recommendation>> ListPendingAsync(Guid? condominiumId = null, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Recommendation>>(
            _recommendations.Values
                .Where(r => r.Status == RecommendationStatus.Pending && (condominiumId == null || r.CondominiumId == condominiumId))
                .OrderBy(r => r.CreatedAt)
                .ToList());

    public Task<IReadOnlyList<Recommendation>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Recommendation>>(
            _recommendations.Values
                .Where(r => r.CondominiumId == condominiumId)
                .OrderByDescending(r => r.CreatedAt)
                .ToList());

    public Task AddAsync(Recommendation recommendation, CancellationToken cancellationToken = default)
    {
        _recommendations[recommendation.Id] = recommendation;
        return Task.CompletedTask;
    }
}
