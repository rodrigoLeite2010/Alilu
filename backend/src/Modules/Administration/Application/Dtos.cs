namespace Alilu.Modules.Administration.Application;

/// <summary>Representação pública de <c>Domain.CondominiumAdministrator</c> — "qual condomínio este CondominiumAdmin administra".</summary>
public sealed record CondominiumAdministratorResponse(
    Guid Id,
    Guid UserId,
    Guid CondominiumId,
    DateTime CreatedAt,
    DateTime UpdatedAt);
