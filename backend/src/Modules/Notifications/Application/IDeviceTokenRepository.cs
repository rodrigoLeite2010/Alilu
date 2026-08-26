using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>Porta de persistência de <see cref="DeviceToken"/> — um por usuário (ver nota em <see cref="DeviceToken"/>).</summary>
public interface IDeviceTokenRepository
{
    Task<DeviceToken?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default);

    /// <summary>React Native: logout — "esquecer" o dispositivo atual, para não receber mais push depois de sair da conta.</summary>
    Task RemoveAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default);
}
