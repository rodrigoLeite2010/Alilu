using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Condominium.Domain;
using Alilu.Modules.Condominium.Infrastructure.Persistence;
using Alilu.Modules.Condominium.Infrastructure.Seed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alilu.Modules.Condominium.Infrastructure;

/// <summary>
/// Ponto único de registro dos serviços do módulo Condominium na
/// composição raiz (Alilu.Api) — espelha
/// <c>Alilu.Modules.Identity.Infrastructure.DependencyInjection</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddCondominiumModule(this IServiceCollection services, IConfiguration configuration)
    {
        // Sem seção própria no appsettings nesta etapa — mantém o parâmetro
        // por consistência de assinatura com os demais módulos (e para uma
        // eventual configuração futura, ex.: validade padrão de convite).
        _ = configuration;
        services.AddSingleton(new CondominiumOptions());

        services.AddScoped<ICondominiumRepository, CondominiumRepository>();
        services.AddScoped<ICondominiumUnitRepository, CondominiumUnitRepository>();
        services.AddScoped<ICondominiumInvitationRepository, CondominiumInvitationRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Sem estado — seguro como singleton (mesmo raciocínio de
        // RefreshTokenGenerator no módulo Identity).
        services.AddSingleton<IInvitationCodeGenerator, InvitationCodeGenerator>();

        services.AddScoped<ICondominiumService, CondominiumService>();
        services.AddScoped<ICondominiumSeeder, CondominiumSeeder>();

        // PROMPT 05 — usados pelo módulo Resident através da Api (nenhum
        // módulo referencia outro; ver IInvitationRedemptionService).
        services.AddScoped<IInvitationRedemptionService, InvitationRedemptionService>();
        services.AddScoped<ICondominiumDirectoryService, CondominiumDirectoryService>();

        return services;
    }
}
