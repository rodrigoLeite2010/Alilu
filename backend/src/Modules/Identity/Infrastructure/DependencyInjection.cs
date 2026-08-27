using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Alilu.Modules.Identity.Infrastructure.Email;
using Alilu.Modules.Identity.Infrastructure.Persistence;
using Alilu.Modules.Identity.Infrastructure.Security;
using Alilu.Modules.Identity.Infrastructure.Seed;
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

        // Refresh Token (Etapa 15): 'Auth:RefreshTokenLifetimeDays' agora é
        // lido de verdade da configuração — antes desta correção, o valor
        // fixo de 30 dias já documentado em AuthOptions era o único
        // possível, mesmo que alguém configurasse a chave no appsettings
        // (ela era silenciosamente ignorada). Sem a chave configurada,
        // continua exatamente 30 dias (mesmo default de sempre).
        var refreshTokenLifetimeDays = configuration.GetValue<int?>("Auth:RefreshTokenLifetimeDays") ?? 30;
        services.AddSingleton(new AuthOptions
        {
            RefreshTokenLifetime = TimeSpan.FromDays(refreshTokenLifetimeDays),
        });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Sem estado — seguros como singleton.
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IRefreshTokenGenerator, RefreshTokenGenerator>();

        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IEmailSender, NoOpEmailSender>();

        services.AddScoped<IAuthService, AuthService>();

        // Bootstrap do primeiro SuperAdmin (Etapa 16) — roda em qualquer
        // ambiente, mas só age se 'Bootstrap:SuperAdminEmail'/
        // 'Bootstrap:SuperAdminPassword' estiverem configurados (ver
        // SuperAdminBootstrapper). Chamado a partir de Program.cs.
        services.AddScoped<ISuperAdminBootstrapper, SuperAdminBootstrapper>();

        return services;
    }
}
