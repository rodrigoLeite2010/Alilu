using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Alilu.Modules.Identity.Infrastructure.Email;
using Alilu.Modules.Identity.Infrastructure.Persistence;
using Alilu.Modules.Identity.Infrastructure.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Identity.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Identity na composição
/// raiz (Alilu.Api) — espelha o padrão de <c>Alilu.Infrastructure.AddInfrastructure</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton(new AuthOptions());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Sem estado — seguros como singleton.
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IRefreshTokenGenerator, RefreshTokenGenerator>();

        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IEmailSender, NoOpEmailSender>();

        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
