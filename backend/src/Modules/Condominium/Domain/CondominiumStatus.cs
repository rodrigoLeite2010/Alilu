namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Situação do condomínio. Novos condomínios nascem <see cref="Active"/>
/// (ver <see cref="Condominium.Register"/>) — <see cref="Inactive"/> fica
/// disponível para uma etapa administrativa futura (ex.: desativar um
/// condomínio sem apagar seu histórico).
/// </summary>
public enum CondominiumStatus
{
    Active = 1,
    Inactive = 2,
}
