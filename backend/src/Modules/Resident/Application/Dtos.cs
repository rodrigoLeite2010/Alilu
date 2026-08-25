using Alilu.Modules.Resident.Domain;

namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Nunca inclui dados de outro módulo (nome/telefone do usuário, nome do
/// condomínio, código da unidade) — só os Ids, exatamente como a entidade
/// os guarda. Enriquecer esta resposta com esses dados (para exibição no
/// app) é responsabilidade da Api, que pode consultar Identity/Condominium
/// e combinar as respostas — este módulo, sozinho, não tem como.
/// </summary>
public sealed record MembershipResponse(
    Guid Id,
    Guid UserId,
    Guid CondominiumId,
    Guid UnitId,
    MembershipStatus Status,
    DateTime? ValidatedAt,
    Guid? ValidatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt);
