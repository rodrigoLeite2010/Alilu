using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Porta de persistência de <see cref="RefreshToken"/>. Implementada em
/// Infrastructure (EF Core); aqui é só a abstração usada pela Application.
/// </summary>
public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);
}
