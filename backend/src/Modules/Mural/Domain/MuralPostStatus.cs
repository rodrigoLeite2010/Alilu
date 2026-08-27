namespace Alilu.Modules.Mural.Domain;

/// <summary>
/// Etapa 23 — decisao de moderacao confirmada por Rodrigo (AskUserQuestion):
/// "Sim, com moderacao" no sentido de PÓS-moderacao — diferente de
/// <c>RecommendationStatus</c> (módulo Recommendations, Etapa 10/PROMPT 10),
/// que nasce <c>Pending</c> e só fica visível depois de um admin aprovar,
/// um <see cref="MuralPost"/> nasce direto <see cref="Visible"/> (visível
/// para todo mundo do condomínio imediatamente) — só depois, se o
/// sindico/admin decidir, ele passa a <see cref="Blocked"/>. Não existe
/// <c>Pending</c> aqui de propósito.
/// </summary>
public enum MuralPostStatus
{
    /// <summary>Visível para os moradores Active do condomínio — estado inicial de todo post.</summary>
    Visible = 1,

    /// <summary>Bloqueado por um administrador (síndico/SuperAdmin) — some do mural geral; continua visível só para o próprio autor e para admins, como histórico (ver <see cref="Application.IMuralService.ListForResidentFeedAsync"/>).</summary>
    Blocked = 2,
}
