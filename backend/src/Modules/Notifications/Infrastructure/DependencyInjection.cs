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
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IDeviceTokenRepository, DeviceTokenRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<INotificationDispatcher, NotificationDispatcher>();
        services.AddScoped<IDeviceTokenService, DeviceTokenService>();

        // HttpClient tipado — ver ExpoPushNotificationSender (chamada HTTP
        // à API pública do Expo).
        services.AddHttpClient<IPushNotificationSender, ExpoPushNotificationSender>();

        return services;
    }
}
