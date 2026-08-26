using System.Net.Http.Headers;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Notifications.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Notifications na
/// composição raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Recommendations.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddNotificationsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IDeviceTokenRepository, DeviceTokenRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
        services.AddScoped<IDeviceTokenService, DeviceTokenService>();

        // HttpClient tipado — ver ExpoPushNotificationSender (chamada HTTP
        // à API pública do Expo). 'PushNotification:ExpoAccessToken' (Etapa
        // 15) é opcional e vazio por padrão: o endpoint público do Expo
        // funciona sem ele; quando configurado (recurso oficial do Expo de
        // "enhanced push security"), passa a ir um cabeçalho
        // "Authorization: Bearer <token>" em toda chamada — nunca
        // hard-coded, sempre vindo de configuração/variável de ambiente.
        var expoAccessToken = configuration["PushNotification:ExpoAccessToken"];
        services
            .AddHttpClient<IPushNotificationSender, ExpoPushNotificationSender>()
            .ConfigureHttpClient(client =>
            {
                if (!string.IsNullOrWhiteSpace(expoAccessToken))
                {
                    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", expoAccessToken);
                }
            });

        return services;
    }
}
