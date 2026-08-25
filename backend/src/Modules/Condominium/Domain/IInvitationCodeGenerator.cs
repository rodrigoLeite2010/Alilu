namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Serviço de domínio para gerar e conferir códigos de convite. Espelha
/// <c>IRefreshTokenGenerator</c> do módulo Identity: o valor bruto
/// (<c>RawCode</c>) é devolvido uma única vez, no momento da criação do
/// convite — nunca persistido, apenas o <c>CodeHash</c>
/// (ver <see cref="CondominiumInvitation"/>).
/// </summary>
public interface IInvitationCodeGenerator
{
    (string RawCode, string CodeHash) Generate();

    string Hash(string rawCode);
}
