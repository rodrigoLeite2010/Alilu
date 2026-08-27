using Alilu.Modules.Reviews.Application;
using Alilu.Modules.Reviews.Domain;

namespace Alilu.Modules.Reviews.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IReviewRepository"/>.</summary>
public sealed class InMemoryReviewRepository : IReviewRepository
{
    private readonly Dictionary<Guid, Review> _reviews = new();

    public Task<Review?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_reviews.GetValueOrDefault(id));

    public Task<Review?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_reviews.Values.FirstOrDefault(r => r.BookingId == bookingId));

    public Task<Review?> GetFreeReviewAsync(Guid residentId, Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_reviews.Values.FirstOrDefault(r => r.ResidentId == residentId && r.ProfessionalId == professionalId && r.BookingId == null));

    public Task<IReadOnlyList<Review>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Review>>(
            _reviews.Values.Where(r => r.ResidentId == residentId).OrderByDescending(r => r.CreatedAt).ToList());

    public Task<IReadOnlyList<Review>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Review>>(
            _reviews.Values.Where(r => r.ProfessionalId == professionalId).OrderByDescending(r => r.CreatedAt).ToList());

    public Task AddAsync(Review review, CancellationToken cancellationToken = default)
    {
        _reviews[review.Id] = review;
        return Task.CompletedTask;
    }
}
