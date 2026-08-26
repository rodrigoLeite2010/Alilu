using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="IDeviceTokenRepository"/>.</summary>
public sealed class InMemoryDeviceTokenRepository : IDeviceTokenRepository
{
    private readonly Dictionary<Guid, DeviceToken> _tokens = new();

    public IReadOnlyCollection<DeviceToken> Tokens => _tokens.Values.ToList();

    public Task<DeviceToken?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_tokens.Values.FirstOrDefault(t => t.UserId == userId));

    public Task AddAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default)
    {
        _tokens[deviceToken.Id] = deviceToken;
        return Task.CompletedTask;
    }

    public Task RemoveAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default)
    {
        _tokens.Remove(deviceToken.Id);
        return Task.CompletedTask;
    }
}
