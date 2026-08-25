using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application.Tests.TestDoubles;

public sealed class InMemoryRefreshTokenRepository : IRefreshTokenRepository
{
    private readonly Dictionary<Guid, RefreshToken> _tokens = new();

    public IReadOnlyCollection<RefreshToken> Tokens => _tokens.Values.ToList();

    public Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        Task.FromResult(_tokens.Values.FirstOrDefault(t => t.TokenHash == tokenHash));

    public Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        _tokens[refreshToken.Id] = refreshToken;
        return Task.CompletedTask;
    }
}
