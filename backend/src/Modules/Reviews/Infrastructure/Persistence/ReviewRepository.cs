using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Reviews.Application;
using Alilu.Modules.Reviews.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Reviews.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IReviewRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class ReviewRepository(AliluDbContext dbContext) : IReviewRepository
{
    public Task<Review?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Review>().FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public Task<Review?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Review>().FirstOrDefaultAsync(r => r.BookingId == bookingId, cancellationToken);

    public Task<Review?> GetFreeReviewAsync(Guid residentId, Guid professionalId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Review>()
            .FirstOrDefaultAsync(r => r.ResidentId == residentId && r.ProfessionalId == professionalId && r.BookingId == null, cancellationToken);

    public async Task<IReadOnlyList<Review>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Review>()
            .Where(r => r.ResidentId == residentId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Review>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Review>()
            .Where(r => r.ProfessionalId == professionalId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Review review, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Review>().AddAsync(review, cancellationToken);
}
