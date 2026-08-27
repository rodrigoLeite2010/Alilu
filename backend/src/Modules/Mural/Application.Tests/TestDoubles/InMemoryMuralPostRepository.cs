using Alilu.Modules.Mural.Application;
using Alilu.Modules.Mural.Domain;

namespace Alilu.Modules.Mural.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IMuralPostRepository"/>.</summary>
public sealed class InMemoryMuralPostRepository : IMuralPostRepository
{
    private readonly Dictionary<Guid, MuralPost> _posts = new();

    public Task<MuralPost?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_posts.GetValueOrDefault(id));

    public Task<IReadOnlyList<MuralPost>> ListForResidentFeedAsync(Guid condominiumId, Guid requestingUserId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<MuralPost>>(
            _posts.Values
                .Where(p => p.CondominiumId == condominiumId && (p.Status == MuralPostStatus.Visible || p.AuthorUserId == requestingUserId))
                .OrderByDescending(p => p.CreatedAt)
                .ToList());

    public Task<IReadOnlyList<MuralPost>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<MuralPost>>(
            _posts.Values.Where(p => p.CondominiumId == condominiumId).OrderByDescending(p => p.CreatedAt).ToList());

    public Task AddAsync(MuralPost post, CancellationToken cancellationToken = default)
    {
        _posts[post.Id] = post;
        return Task.CompletedTask;
    }
}
