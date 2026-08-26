using Alilu.Modules.Recommendations.Application;
using Alilu.Modules.Recommendations.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Recommendations.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Recommendations na
/// composição raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Reviews.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddRecommendationsModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IRecommendationRepository, RecommendationRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IRecommendationService, RecommendationService>();
        services.AddScoped<IRecommendationDirectoryService, RecommendationDirectoryService>();
        services.AddScoped<IRecommendationAdministrationService, RecommendationAdministrationService>();

        return services;
    }
}
