using System.Text.RegularExpressions;

using Alilu.Shared;

namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Convite para que uma pessoa (identificada por e-mail) se associe a uma
/// unidade de um condomínio. Quem consome esse convite (fluxo de
/// cadastro/redemption de um morador) pertence ao módulo Resident — ainda
/// não implementado (ver PROMPT 04) — esta etapa só cria e consulta o
/// convite.
///
/// SEGURANÇA: apenas <see cref="CodeHash"/> é armazenado — o código bruto
/// nunca é persistido (ver <see cref="IInvitationCodeGenerator"/>), mesmo
/// padrão do <c>RefreshToken</c> no módulo Identity.
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>Condominium</c>/<c>CondominiumUnit</c>, só os Ids como valores
/// simples (mesma decisão de <see cref="CondominiumUnit"/> acima).
/// </summary>
public sealed partial class CondominiumInvitation : AggregateRoot
{
    public Guid CondominiumId { get; private set; }
    public Guid UnitId { get; private set; }
    public string Email { get; private set; }
    public string CodeHash { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? UsedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }

#pragma warning disable CS8618
    private CondominiumInvitation()
    {
    }
#pragma warning restore CS8618

    private CondominiumInvitation(Guid id, Guid condominiumId, Guid unitId, string email, string codeHash, DateTime expiresAtUtc)
        : base(id)
    {
        CondominiumId = condominiumId;
        UnitId = unitId;
        Email = email;
        CodeHash = codeHash;
        ExpiresAt = expiresAtUtc;
        CreatedAt = DateTime.UtcNow;
    }

    public static CondominiumInvitation Create(
        Guid condominiumId,
        Guid unitId,
        string email,
        string codeHash,
        DateTime expiresAtUtc)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O convite precisa de um condomínio válido.");
        }

        if (unitId == Guid.Empty)
        {
            throw new DomainException("O convite precisa de uma unidade válida.");
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new DomainException("O e-mail do convite não pode ser vazio.");
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (normalizedEmail.Length > 254 || !EmailRegex().IsMatch(normalizedEmail))
        {
            throw new DomainException("O e-mail do convite não é válido.");
        }

        if (string.IsNullOrWhiteSpace(codeHash))
        {
            throw new DomainException("O convite precisa de um código.");
        }

        if (expiresAtUtc <= DateTime.UtcNow)
        {
            throw new DomainException("A expiração do convite deve estar no futuro.");
        }

        return new CondominiumInvitation(Guid.NewGuid(), condominiumId, unitId, normalizedEmail, codeHash, expiresAtUtc);
    }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

    public bool IsUsed => UsedAt is not null;

    /// <summary>Válido = ainda não utilizado e dentro da validade.</summary>
    public bool IsValid => !IsUsed && !IsExpired;

    /// <summary>
    /// Marca o convite como utilizado. Não é idempotente feito
    /// <c>RefreshToken.Revoke</c> — reaproveitar um convite (ou usar um já
    /// expirado) é um erro, não um no-op, porque um convite representa uma
    /// autorização de uso único para uma unidade específica.
    /// </summary>
    public void MarkAsUsed()
    {
        if (IsUsed)
        {
            throw new DomainException("Este convite já foi utilizado.");
        }

        if (IsExpired)
        {
            throw new DomainException("Este convite expirou.");
        }

        UsedAt = DateTime.UtcNow;
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
