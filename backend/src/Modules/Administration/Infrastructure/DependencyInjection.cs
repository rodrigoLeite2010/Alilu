using Alilu.Modules.Administration.Application;
using Alilu.Modules.Administration.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Administration.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Administration na
/// composição raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Recommendations.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddAdministrationModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<ICondominiumAdministratorRepository, CondominiumAdministratorRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IAdminScopeService, AdminScopeService>();

        return services;
    }
}
