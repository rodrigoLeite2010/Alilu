using Alilu.Shared;

namespace Alilu.Modules.Notifications.Domain;

/// <summary>
/// O token de push (Expo) do dispositivo atual de um usuário (PROMPT 11 —
/// "Configurar device token"). Não é uma entidade pedida pela lista
/// ENTIDADE do prompt (que só descreve <see cref="Notification"/>) — existe
/// porque "criar Push Notifications" não é possível sem guardar, em algum
/// lugar, para qual dispositivo enviar; nasce e mora neste módulo porque é
/// puramente uma preocupação de entrega de notificação, não um conceito de
/// negócio novo.
///
/// Um usuário real pode ter mais de um dispositivo (celular + tablet), mas
/// o prompt não pede esse modelo — mantemos UM token por usuário
/// (sobrescrito a cada novo registro, ver <see cref="UpdateToken"/>),
/// suficiente para o MVP de push desta etapa; documentado como decisão de
/// escopo em ARCHITECTURE.md.
/// </summary>
public sealed class DeviceToken : AggregateRoot
{
    public Guid UserId { get; private set; }
    public string Token { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

#pragma warning disable CS8618
    private DeviceToken()
    {
    }
#pragma warning restore CS8618

    private DeviceToken(Guid id, Guid userId, string token)
        : base(id)
    {
        UserId = userId;
        Token = token;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
    }

    public static DeviceToken Register(Guid userId, string token)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("O token de dispositivo precisa de um usuário válido.");
        }

        var trimmed = string.IsNullOrWhiteSpace(token) ? null : token.Trim();
        if (trimmed is null)
        {
            throw new DomainException("O token do dispositivo não pode ser vazio.");
        }

        return new DeviceToken(Guid.NewGuid(), userId, trimmed);
    }

    /// <summary>Sobrescreve o token (ex.: o app reabriu e o Expo devolveu um token novo). Mesmo usuário, mesma linha — ver nota da classe.</summary>
    public void UpdateToken(string token)
    {
        var trimmed = string.IsNullOrWhiteSpace(token) ? null : token.Trim();
        if (trimmed is null)
        {
            throw new DomainException("O token do dispositivo não pode ser vazio.");
        }

        Token = trimmed;
        UpdatedAt = DateTime.UtcNow;
    }
}
