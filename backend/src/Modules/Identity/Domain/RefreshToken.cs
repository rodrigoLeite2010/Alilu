using Alilu.Shared;

namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Refresh token de uma sessão. É sua própria raiz de agregado (não faz
/// parte do agregado <see cref="User"/>) porque é consultado diretamente
/// pelo hash no login/refresh/revoke, sem precisar carregar o usuário
/// inteiro — e um usuário pode acumular muitos tokens ao longo do tempo
/// (um por sessão/dispositivo).
///
/// SEGURANÇA: apenas <see cref="TokenHash"/> é armazenado — o valor bruto
/// do token nunca é persistido (ver <see cref="IRefreshTokenGenerator"/>).
/// Rotação: ao usar um refresh token válido para obter novos tokens, ele
/// deve ser revogado (<see cref="Revoke"/>) e um novo
/// <see cref="RefreshToken"/> criado — nunca reutilizado.
/// </summary>
public sealed class RefreshToken : AggregateRoot
{
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }

#pragma warning disable CS8618
    private RefreshToken()
    {
    }
#pragma warning restore CS8618

    private RefreshToken(Guid id, Guid userId, string tokenHash, DateTime expiresAt)
        : base(id)
    {
        UserId = userId;
        TokenHash = tokenHash;
        ExpiresAt = expiresAt;
        CreatedAt = DateTime.UtcNow;
    }

    public static RefreshToken Create(Guid userId, string tokenHash, DateTime expiresAtUtc)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("RefreshToken precisa de um usuário válido.");
        }

        if (string.IsNullOrWhiteSpace(tokenHash))
        {
            throw new DomainException("RefreshToken precisa de um hash válido.");
        }

        if (expiresAtUtc <= DateTime.UtcNow)
        {
            throw new DomainException("A expiração do RefreshToken deve estar no futuro.");
        }

        return new RefreshToken(Guid.NewGuid(), userId, tokenHash, expiresAtUtc);
    }

    public bool IsRevoked => RevokedAt is not null;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

    /// <summary>Ativo = não revogado e ainda dentro da validade.</summary>
    public bool IsActive => !IsRevoked && !IsExpired;

    public void Revoke()
    {
        if (IsRevoked)
        {
            return; // idempotente — revogar duas vezes não é erro
        }

        RevokedAt = DateTime.UtcNow;
    }
}
