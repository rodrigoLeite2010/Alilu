using Alilu.Modules.Scheduling.Application;
using Alilu.Modules.Scheduling.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Scheduling.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Scheduling na composição
/// raiz (Alilu.Api) — espelha <c>Alilu.Modules.Professional.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddSchedulingModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IBookingRepository, BookingRepository>();
        services.AddScoped<IBookingItemRepository, BookingItemRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IBookingService, BookingService>();
        services.AddScoped<IProfessionalBookingService, ProfessionalBookingService>();

        return services;
    }
}
