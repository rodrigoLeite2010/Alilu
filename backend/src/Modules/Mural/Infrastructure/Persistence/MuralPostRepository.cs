using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Mural.Application;
using Alilu.Modules.Mural.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Mural.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IMuralPostRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class MuralPostRepository(AliluDbContext dbContext) : IMuralPostRepository
{
    public Task<MuralPost?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<MuralPost>().FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public async Task<IReadOnlyList<MuralPost>> ListForResidentFeedAsync(Guid condominiumId, Guid requestingUserId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<MuralPost>()
            .Where(p => p.CondominiumId == condominiumId
                && (p.Status == MuralPostStatus.Visible || p.AuthorUserId == requestingUserId))
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<MuralPost>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<MuralPost>()
            .Where(p => p.CondominiumId == condominiumId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(MuralPost post, CancellationToken cancellationToken = default) =>
        await dbContext.Set<MuralPost>().AddAsync(post, cancellationToken);
}
