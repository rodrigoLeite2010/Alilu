using Alilu.Modules.Mural.Domain;

namespace Alilu.Modules.Mural.Application;

/// <summary>Implementação de <see cref="IMuralService"/> — ver comentário de design lá.</summary>
public sealed class MuralService(
    IMuralPostRepository muralPostRepository,
    IUnitOfWork unitOfWork) : IMuralService
{
    public async Task<MuralPostResponse> CreateAsync(
        Guid condominiumId,
        Guid authorUserId,
        MuralPostType type,
        string content,
        CancellationToken cancellationToken = default)
    {
        var post = MuralPost.Post(condominiumId, authorUserId, type, content);

        await muralPostRepository.AddAsync(post, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MuralMapper.ToResponse(post);
    }

    public async Task<IReadOnlyList<MuralPostResponse>> ListForResidentFeedAsync(
        Guid condominiumId,
        Guid requestingUserId,
        CancellationToken cancellationToken = default)
    {
        var posts = await muralPostRepository.ListForResidentFeedAsync(condominiumId, requestingUserId, cancellationToken);
        return posts.Select(MuralMapper.ToResponse).ToList();
    }
}
