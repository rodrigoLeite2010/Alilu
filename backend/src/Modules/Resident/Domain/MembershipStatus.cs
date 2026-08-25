namespace Alilu.Modules.Resident.Domain;

/// <summary>
/// Estado do vínculo morador↔condomínio↔unidade (<see cref="CondominiumMembership"/>).
///
/// Pending: aguardando validação (convite ainda não resgatado não gera
/// registro nenhum — só a solicitação manual, FLUXO 2, nasce Pending).
/// Active: vínculo válido — o usuário pode entrar no app do morador.
/// Rejected: solicitação (FLUXO 2) recusada por um administrador.
/// Blocked: vínculo que já foi Active e foi bloqueado por um administrador.
/// </summary>
public enum MembershipStatus
{
    Pending = 1,
    Active = 2,
    Rejected = 3,
    Blocked = 4,
}
