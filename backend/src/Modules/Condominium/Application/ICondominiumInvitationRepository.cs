using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Porta de persistência de <see cref="CondominiumInvitation"/>.</summary>
public interface ICondominiumInvitationRepository
{
    Task<CondominiumInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Busca pelo hash do código (nunca pelo código bruto — ver
    /// <see cref="Domain.CondominiumInvitation.CodeHash"/>). Usado pelo
    /// resgate de convite (PROMPT 05, <c>InvitationRedemptionService</c>) —
    /// quem chama já deve ter hasheado o código digitado antes de chegar
    /// aqui (ver <see cref="IInvitationCodeGenerator.Hash"/>).
    /// </summary>
    Task<CondominiumInvitation?> GetByCodeHashAsync(string codeHash, CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumInvitation invitation, CancellationToken cancellationToken = default);
}
