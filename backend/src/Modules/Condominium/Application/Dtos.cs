using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

public sealed record CreateCondominiumRequest(
    string Name,
    string Cnpj,
    string Address,
    string Number,
    string Neighborhood,
    string City,
    string State,
    string ZipCode);

public sealed record CondominiumResponse(
    Guid Id,
    string Name,
    string Cnpj,
    string Address,
    string Number,
    string Neighborhood,
    string City,
    string State,
    string ZipCode,
    CondominiumStatus Status,
    DateTime CreatedAt);

public sealed record CreateUnitRequest(Guid CondominiumId, string Code, UnitType Type);

public sealed record CondominiumUnitResponse(
    Guid Id,
    Guid CondominiumId,
    string Code,
    UnitType Type,
    UnitStatus Status,
    DateTime CreatedAt);

/// <summary>
/// <paramref name="ExpirationDays"/> é opcional — quando omitido ou menor
/// ou igual a zero, <see cref="CondominiumOptions.DefaultInvitationExpirationDays"/> é usado.
/// </summary>
public sealed record CreateInvitationRequest(Guid CondominiumId, Guid UnitId, string Email, int? ExpirationDays);

/// <summary>
/// Devolvido apenas na criação do convite — é a única vez que o código
/// bruto (<see cref="Code"/>) fica disponível; depois disso só o hash é
/// guardado (ver <see cref="CondominiumInvitation"/>).
/// </summary>
public sealed record CondominiumInvitationCreatedResponse(
    Guid Id,
    Guid CondominiumId,
    Guid UnitId,
    string Email,
    string Code,
    DateTime ExpiresAt,
    DateTime CreatedAt);

public enum InvitationStatus
{
    Pending,
    Used,
    Expired,
}

/// <summary>Nunca inclui o código (bruto ou hash) — usado para consulta administrativa do estado do convite.</summary>
public sealed record CondominiumInvitationResponse(
    Guid Id,
    Guid CondominiumId,
    Guid UnitId,
    string Email,
    InvitationStatus Status,
    DateTime ExpiresAt,
    DateTime? UsedAt,
    DateTime CreatedAt);

// PROMPT 05 — resgate de convite (self-service, IInvitationRedemptionService)
// e diretório público de condomínios/unidades (ICondominiumDirectoryService).
// Ambos usados pelo módulo Resident através da Api (composição raiz) — ver
// comentário de segurança em IInvitationRedemptionService.

/// <summary>
/// Resultado de <c>IInvitationRedemptionService.ValidateInvitationAsync</c>:
/// os dados do convite já resolvidos e confiáveis (nunca vindos do
/// cliente) — <see cref="CondominiumId"/>/<see cref="UnitId"/> são os que o
/// próprio convite define, não o que quem chamou "gostaria" que fossem.
/// </summary>
public sealed record InvitationValidationResult(
    Guid InvitationId,
    Guid CondominiumId,
    Guid UnitId,
    string Email);

/// <summary>Resumo público de um condomínio, para o morador escolher (FLUXO 2 — "Não encontrei minha unidade").</summary>
public sealed record CondominiumSummaryResponse(Guid Id, string Name, string City, string State);

/// <summary>Resumo público de uma unidade, para o morador escolher dentro de um condomínio já escolhido.</summary>
public sealed record CondominiumUnitSummaryResponse(Guid Id, string Code, UnitType Type);
