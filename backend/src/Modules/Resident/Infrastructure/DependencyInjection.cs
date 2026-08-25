using Alilu.Modules.Resident.Application;
using Alilu.Modules.Resident.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Resident.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Resident na composição
/// raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Condominium.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddResidentModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IMembershipRepository, MembershipRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IMembershipService, MembershipService>();
        services.AddScoped<IMembershipAdministrationService, MembershipAdministrationService>();

        return services;
    }
}
