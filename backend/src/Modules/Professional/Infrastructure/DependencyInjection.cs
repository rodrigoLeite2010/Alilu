using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Infrastructure.Persistence;
using Alilu.Modules.Professional.Infrastructure.Seed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

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
        services.AddScoped<IProfessionalRepository, ProfessionalRepository>();
        services.AddScoped<IServiceCategoryRepository, ServiceCategoryRepository>();
        services.AddScoped<IProfessionalCategoryRepository, ProfessionalCategoryRepository>();
        services.AddScoped<IProfessionalServiceRepository, ProfessionalServiceRepository>();
        services.AddScoped<IProfessionalCondominiumRepository, ProfessionalCondominiumRepository>();
        services.AddScoped<IProfessionalAvailabilityRepository, ProfessionalAvailabilityRepository>();
        services.AddScoped<IProfessionalAvailabilityExceptionRepository, ProfessionalAvailabilityExceptionRepository>();
        services.AddScoped<IProfessionalInvitationRepository, ProfessionalInvitationRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        services.AddScoped<IProfessionalProfileService, ProfessionalProfileService>();
        services.AddScoped<IProfessionalDirectoryService, ProfessionalDirectoryService>();
        services.AddScoped<IProfessionalAdministrationService, ProfessionalAdministrationService>();
        services.AddScoped<IProfessionalAvailabilityService, ProfessionalAvailabilityService>();
        services.AddScoped<IProfessionalInvitationService, ProfessionalInvitationService>();

        services.AddScoped<IProfessionalCategorySeeder, ProfessionalCategorySeeder>();
        services.AddScoped<IServiceCategorySeeder, ServiceCategorySeeder>();

        AddInvitationChannelSenders(services, configuration);

        return services;
    }

    /// <summary>
    /// Etapa 23 (pedido 1 de Rodrigo — "convidar um prestador"): registra
    /// os senders REAIS (Twilio WhatsApp/SMS, Twilio SendGrid) só quando
    /// as credenciais correspondentes estão configuradas; caso contrário,
    /// registra o sender "fake" (log em vez de enviar de verdade) —
    /// exatamente o que o plano da Etapa 23 propôs para permitir escrever
    /// e testar o recurso antes da conta Twilio estar pronta. Mesmo
    /// espírito do <c>PushNotification:ExpoAccessToken</c> opcional
    /// (módulo Notifications, Etapa 11/15), só que lá o endpoint público
    /// funciona SEM credencial — aqui, sem credencial, não há chamada
    /// nenhuma à Twilio/SendGrid (nunca com uma credencial vazia).
    ///
    /// <c>WhatsAppContentSid</c> também é exigido para o WhatsApp real
    /// (além de AccountSid/AuthToken/WhatsAppFrom) — confirmado por
    /// Rodrigo com uma chamada real à Twilio: mensagem iniciada pela
    /// empresa só é aceita pela Meta via Content Template pré-aprovado,
    /// nunca texto livre. Sem ele, mesmo com as outras três credenciais
    /// preenchidas, cai no sender fake (mais seguro que tentar enviar
    /// texto livre e a Twilio rejeitar em silêncio).
    /// </summary>
    private static void AddInvitationChannelSenders(IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpClient("Twilio");
        services.AddHttpClient("SendGrid");

        var twilioAccountSid = configuration["Twilio:AccountSid"];
        var twilioAuthToken = configuration["Twilio:AuthToken"];
        var twilioWhatsAppFrom = configuration["Twilio:WhatsAppFrom"];
        var twilioWhatsAppContentSid = configuration["Twilio:WhatsAppContentSid"];
        var twilioSmsFrom = configuration["Twilio:SmsFrom"];
        var sendGridApiKey = configuration["SendGrid:ApiKey"];
        var sendGridFromEmail = configuration["SendGrid:FromEmail"];

        var hasTwilioCoreCredentials = !string.IsNullOrWhiteSpace(twilioAccountSid) && !string.IsNullOrWhiteSpace(twilioAuthToken);

        // "WhatsAppContentSid" também é exigido — ver comentário do método.
        if (hasTwilioCoreCredentials && !string.IsNullOrWhiteSpace(twilioWhatsAppFrom) && !string.IsNullOrWhiteSpace(twilioWhatsAppContentSid))
        {
            services.AddScoped<IWhatsAppMessageSender>(sp => new TwilioWhatsAppSender(
                sp.GetRequiredService<IHttpClientFactory>(),
                twilioAccountSid!,
                twilioAuthToken!,
                twilioWhatsAppFrom!,
                twilioWhatsAppContentSid!,
                sp.GetRequiredService<ILogger<TwilioWhatsAppSender>>()));
        }
        else
        {
            services.AddScoped<IWhatsAppMessageSender, LoggingWhatsAppSender>();
        }

        if (hasTwilioCoreCredentials && !string.IsNullOrWhiteSpace(twilioSmsFrom))
        {
            services.AddScoped<ISmsMessageSender>(sp => new TwilioSmsSender(
                sp.GetRequiredService<IHttpClientFactory>(),
                twilioAccountSid!,
                twilioAuthToken!,
                twilioSmsFrom!,
                sp.GetRequiredService<ILogger<TwilioSmsSender>>()));
        }
        else
        {
            services.AddScoped<ISmsMessageSender, LoggingSmsSender>();
        }

        if (!string.IsNullOrWhiteSpace(sendGridApiKey) && !string.IsNullOrWhiteSpace(sendGridFromEmail))
        {
            services.AddScoped<IEmailMessageSender>(sp => new SendGridEmailSender(
                sp.GetRequiredService<IHttpClientFactory>(),
                sendGridApiKey!,
                sendGridFromEmail!,
                sp.GetRequiredService<ILogger<SendGridEmailSender>>()));
        }
        else
        {
            services.AddScoped<IEmailMessageSender, LoggingEmailSender>();
        }
    }
}
