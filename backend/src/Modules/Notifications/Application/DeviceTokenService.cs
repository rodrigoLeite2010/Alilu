using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>Implementação de <see cref="IDeviceTokenService"/> — ver comentário de design lá.</summary>
public sealed class DeviceTokenService(
    IDeviceTokenRepository deviceTokenRepository,
    IUnitOfWork unitOfWork) : IDeviceTokenService
{
    public async Task RegisterMyTokenAsync(Guid userId, string token, CancellationToken cancellationToken = default)
    {
        var existing = await deviceTokenRepository.GetByUserIdAsync(userId, cancellationToken);

        if (existing is not null)
        {
            existing.UpdateToken(token);
        }
        else
        {
            await deviceTokenRepository.AddAsync(DeviceToken.Register(userId, token), cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task RemoveMyTokenAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var existing = await deviceTokenRepository.GetByUserIdAsync(userId, cancellationToken);
        if (existing is null)
        {
            return;
        }

        await deviceTokenRepository.RemoveAsync(existing, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
