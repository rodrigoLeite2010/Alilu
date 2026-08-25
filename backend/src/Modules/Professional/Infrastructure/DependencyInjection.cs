using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Infrastructure.Persistence;
using Alilu.Modules.Professional.Infrastructure.Seed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Professional na
/// composição raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Resident.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddProfessionalModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IProfessionalRepository, ProfessionalRepository>();
        services.AddScoped<IServiceCategoryRepository, ServiceCategoryRepository>();
        services.AddScoped<IProfessionalServiceRepository, ProfessionalServiceRepository>();
        services.AddScoped<IProfessionalCondominiumRepository, ProfessionalCondominiumRepository>();
        services.AddScoped<IProfessionalAvailabilityRepository, ProfessionalAvailabilityRepository>();
        services.AddScoped<IProfessionalAvailabilityExceptionRepository, ProfessionalAvailabilityExceptionRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IProfessionalProfileService, ProfessionalProfileService>();
        services.AddScoped<IProfessionalDirectoryService, ProfessionalDirectoryService>();
        services.AddScoped<IProfessionalAdministrationService, ProfessionalAdministrationService>();
        services.AddScoped<IProfessionalAvailabilityService, ProfessionalAvailabilityService>();

        services.AddScoped<IServiceCategorySeeder, ServiceCategorySeeder>();

        return services;
    }
}
