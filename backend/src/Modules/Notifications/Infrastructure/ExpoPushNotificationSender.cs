using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Notifications.Infrastructure;

/// <summary>
/// Implementação de <see cref="IPushNotificationSender"/> via a API HTTP
/// pública do Expo ("React Native: Utilizar Expo Notifications") — POST
/// para <c>https://exp.host/--/api/v2/push/send</c> com o token, título e
/// mensagem já prontos (sem nenhum dado sensível — isso é responsabilidade
/// de quem monta <c>title</c>/<c>message</c>, ver <see cref="NotificationDispatcher"/>).
///
/// Registrado como <c>HttpClient</c> tipado (ver <c>DependencyInjection.AddNotificationsModule</c>).
/// Cumpre o contrato da interface (NUNCA lança): qualquer falha — rede
/// indisponível, token inválido/expirado, resposta de erro do Expo — é só
/// logada, nunca propagada, para não derrubar a ação de negócio que
/// originou a notificação.
///
/// LIMITAÇÃO DO SANDBOX (Claude): este container de build não tem acesso à
/// internet, então esta classe nunca foi (nem poderia ser) exercitada
/// contra o serviço real do Expo aqui — ver ARCHITECTURE.md, "Etapa 11",
/// seção de verificação.
/// </summary>
public sealed class ExpoPushNotificationSender(HttpClient httpClient, ILogger<ExpoPushNotificationSender> logger) : IPushNotificationSender
{
    private const string ExpoPushEndpoint = "https://exp.host/--/api/v2/push/send";

    public async Task SendAsync(
        string expoPushToken,
        string title,
        string message,
        NotificationType type,
        Guid? referenceId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new ExpoPushMessage(expoPushToken, title, message)
            {
                Data = new ExpoPushData(type.ToString(), referenceId?.ToString()),
            };
            using var response = await httpClient.PostAsJsonAsync(ExpoPushEndpoint, payload, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Falha ao enviar push via Expo (status {StatusCode}) — a notificação interna já foi gravada normalmente.",
                    response.StatusCode);
            }
        }
        catch (Exception exception)
        {
            // Contrato de IPushNotificationSender: nunca propagar. Uma
            // instabilidade do Expo não pode derrubar, por exemplo, a
            // criação de um agendamento.
            logger.LogWarning(exception, "Erro ao enviar push via Expo — a notificação interna já foi gravada normalmente.");
        }
    }

    /// <summary>
    /// Corpo aceito por <c>POST https://exp.host/--/api/v2/push/send</c> —
    /// os nomes de campo do Expo são minúsculos ("to"/"title"/"body"/
    /// "sound"), por isso <see cref="JsonPropertyNameAttribute"/> em cada
    /// um (o resto da Api usa PascalCase→camelCase via
    /// <c>JsonStringEnumConverter</c>/convenção padrão do ASP.NET Core,
    /// mas este é um payload para um serviço externo, não para o mobile).
    /// </summary>
    private sealed record ExpoPushMessage(
        [property: JsonPropertyName("to")] string To,
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("body")] string Body)
    {
        [JsonPropertyName("sound")]
        public string Sound { get; init; } = "default";

        [JsonPropertyName("data")]
        public ExpoPushData? Data { get; init; }
    }

    /// <summary>
    /// Vai no campo "data" do payload do Expo — NUNCA em "title"/"body"
    /// (REGRA "não expor informações sensíveis na notificação"): só o
    /// suficiente para o app resolver a tela ao tocar num push do sistema
    /// (ver <see cref="IPushNotificationSender"/> e
    /// <c>notificationRouting.ts</c> no mobile, que lê estes mesmos nomes
    /// de campo: "type"/"referenceId").
    /// </summary>
    private sealed record ExpoPushData(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("referenceId")] string? ReferenceId);
}
