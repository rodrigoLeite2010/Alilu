using Alilu.Modules.Mural.Application;
using Alilu.Modules.Mural.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Mural.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Mural na composição raiz
/// (Alilu.Api) — espelha
/// <c>Alilu.Modules.Recommendations.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddMuralModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IMuralPostRepository, MuralPostRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IMuralService, MuralService>();
        services.AddScoped<IMuralAdministrationService, MuralAdministrationService>();

        return services;
    }
}
