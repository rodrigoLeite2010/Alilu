using Alilu.Modules.Reviews.Application;
using Alilu.Modules.Reviews.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Reviews.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Reviews na composição raiz
/// (Alilu.Api) — espelha <c>Alilu.Modules.Scheduling.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddReviewsModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos.
        _ = configuration;

        services.AddScoped<IReviewRepository, ReviewRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IReviewService, ReviewService>();
        services.AddScoped<IProfessionalReviewService, ProfessionalReviewService>();

        return services;
    }
}
