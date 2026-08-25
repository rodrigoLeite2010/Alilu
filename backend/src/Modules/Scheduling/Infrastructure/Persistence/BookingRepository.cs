using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Scheduling.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IBookingRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class BookingRepository(AliluDbContext dbContext) : IBookingRepository
{
    public Task<Booking?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Booking>().FirstOrDefaultAsync(b => b.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Booking>> ListByResidentIdAsync(Guid residentId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Booking>()
            .Where(b => b.ResidentId == residentId)
            .OrderByDescending(b => b.ScheduledDate).ThenByDescending(b => b.StartTime)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Booking>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Booking>()
            .Where(b => b.ProfessionalId == professionalId)
            .OrderByDescending(b => b.ScheduledDate).ThenByDescending(b => b.StartTime)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Booking>> ListHoldingByProfessionalIdAndDateAsync(
        Guid professionalId,
        DateOnly scheduledDate,
        CancellationToken cancellationToken = default) =>
        // Mesmo conjunto de Booking.OccupiesSlot, escrito por extenso (em
        // vez de reaproveitar a propriedade de Domain) porque esta consulta
        // precisa virar SQL — mesmo estilo de comparação explícita por
        // igualdade usado em ProfessionalCondominiumRepository.ExistsActiveOrPendingAsync
        // (Etapa 06), evitando depender de tradução de `Contains` sobre um
        // array em memória, que este sandbox não tem como testar.
        await dbContext.Set<Booking>()
            .Where(b =>
                b.ProfessionalId == professionalId
                && b.ScheduledDate == scheduledDate
                && (b.Status == BookingStatus.Requested
                    || b.Status == BookingStatus.Confirmed
                    || b.Status == BookingStatus.InProgress
                    || b.Status == BookingStatus.Completed))
            .ToListAsync(cancellationToken);

    public async Task AddAsync(Booking booking, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Booking>().AddAsync(booking, cancellationToken);
}
