namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Opções de negócio do módulo Condominium. POCO simples (sem depender de
/// <c>Microsoft.Extensions.Options</c>), mesmo padrão de
/// <c>Alilu.Modules.Identity.Application.AuthOptions</c>.
/// </summary>
public sealed class CondominiumOptions
{
    /// <summary>Validade padrão de um convite quando a requisição não informa uma.</summary>
    public int DefaultInvitationExpirationDays { get; init; } = 7;
}
