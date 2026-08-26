namespace Alilu.Modules.Notifications.Application;

/// <summary>Casos de uso self-service de "Configurar device token" (PROMPT 11, React Native). Registro/remoção são sempre restritos ao próprio usuário autenticado.</summary>
public interface IDeviceTokenService
{
    /// <summary>React Native: chamado logo após o app obter/renovar o Expo push token. Upsert — um usuário tem um único token guardado (ver <c>DeviceToken</c>).</summary>
    Task RegisterMyTokenAsync(Guid userId, string token, CancellationToken cancellationToken = default);

    /// <summary>React Native: logout — para de receber push neste dispositivo. Idempotente (não lança se já não houver token).</summary>
    Task RemoveMyTokenAsync(Guid userId, CancellationToken cancellationToken = default);
}
