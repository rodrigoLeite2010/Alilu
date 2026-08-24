using Alilu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços de infraestrutura na composição raiz (Alilu.Api).
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AliluDatabase")
            ?? throw new InvalidOperationException(
                "A connection string 'AliluDatabase' não foi configurada.");

        services.AddDbContext<AliluDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }
}
