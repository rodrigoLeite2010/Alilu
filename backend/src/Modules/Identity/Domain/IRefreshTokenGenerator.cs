namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Serviço de domínio para gerar e conferir refresh tokens.
///
/// O valor bruto (<c>RawToken</c>) é devolvido ao cliente uma única vez
/// (no login/refresh) e nunca é persistido — apenas o hash
/// (<c>TokenHash</c>) é guardado em <see cref="RefreshToken"/>. Para
/// validar um token recebido do cliente, usar <see cref="Hash"/> no valor
/// recebido e comparar com o <c>TokenHash</c> armazenado.
/// </summary>
public interface IRefreshTokenGenerator
{
    (string RawToken, string TokenHash) Generate();

    string Hash(string rawToken);
}
