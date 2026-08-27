namespace Alilu.Modules.Mural.Application;

/// <summary>Implementação de <see cref="IMuralAdministrationService"/> — ver comentário de design lá.</summary>
public sealed class MuralAdministrationService(
    IMuralPostRepository muralPostRepository,
    IUnitOfWork unitOfWork) : IMuralAdministrationService
{
    public async Task<IReadOnlyList<MuralPostResponse>> ListByCondominiumAsync(
        MuralRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);
        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var posts = await muralPostRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return posts.Select(MuralMapper.ToResponse).ToList();
    }

    public async Task<MuralPostResponse> BlockAsync(
        MuralRequesterRole requesterRole,
        Guid blockedByUserId,
        Guid muralPostId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var post = await muralPostRepository.GetByIdAsync(muralPostId, cancellationToken)
            ?? throw new MuralPostNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, post.CondominiumId);

        if (!post.IsVisible)
        {
            throw new MuralPostAlreadyBlockedException();
        }

        post.Block(blockedByUserId);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return MuralMapper.ToResponse(post);
    }

    private static void EnsureIsAdmin(MuralRequesterRole requesterRole)
    {
        if (requesterRole is not (MuralRequesterRole.CondominiumAdmin or MuralRequesterRole.SuperAdmin))
        {
            throw new InsufficientPermissionsException();
        }
    }

    /// <summary>
    /// "CondominiumAdmin somente pode administrar seu próprio condomínio"
    /// (PROMPT 12) — <paramref name="scopeCondominiumId"/> nulo (SuperAdmin)
    /// sempre passa; não-nulo só passa se igual a
    /// <paramref name="targetCondominiumId"/>. Resolvido pela Api via
    /// <c>Administration.IAdminScopeService</c> antes de chamar este módulo.
    /// </summary>
    private static void EnsureScopeMatches(Guid? scopeCondominiumId, Guid targetCondominiumId)
    {
        if (scopeCondominiumId is not null && scopeCondominiumId.Value != targetCondominiumId)
        {
            throw new InsufficientPermissionsException();
        }
    }
}
