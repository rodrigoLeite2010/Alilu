namespace Alilu.Modules.Recommendations.Domain;

/// <summary>
/// Estado da indicação de um profissional feita por um morador
/// (<see cref="Recommendation"/>) — PROMPT 10.
///
/// Pending: aguardando moderação administrativa (toda indicação nasce
/// assim). Approved: liberada para aparecer publicamente (contagem de
/// "recomendado por N moradores", listagem do profissional). Rejected:
/// recusada por um administrador. Blocked: indicação que já foi Approved e
/// foi bloqueada por um administrador (ex.: denúncia de indicação falsa) —
/// mesma forma dos dois estados terminais negativos de
/// <c>MembershipStatus</c>/<c>ProfessionalCondominiumStatus</c>, mas aqui
/// Block parte de Approved, não de Pending (Reject já cobre o caminho
/// Pending→negativo).
/// </summary>
public enum RecommendationStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Blocked = 4,
}
