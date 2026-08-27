using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalInvitation"/>.</summary>
public interface IProfessionalInvitationRepository
{
    /// <summary>
    /// "Limite de envio" (Etapa 23, decisão registrada no plano: 10
    /// convites/dia por morador) — conta quantos convites este morador já
    /// enviou desde <paramref name="sinceUtc"/> (a Application passa
    /// <c>DateTime.UtcNow.AddDays(-1)</c>), antes de criar um novo.
    ///
    /// LIMITAÇÃO CONHECIDA (mesma classe de bug corrigida na Etapa 14 para
    /// o módulo Recommendations — "não permitir spam ilimitado"): esta
    /// checagem é "contar, comparar com o teto, então inserir", sem
    /// transação <c>Serializable</c> — duas requisições verdadeiramente
    /// simultâneas do mesmo morador podem, na pior hipótese, ultrapassar o
    /// teto em 1. Aceito de propósito nesta etapa (impacto baixo — é só um
    /// limite de taxa contra abuso casual, não uma regra de unicidade de
    /// negócio) em vez de replicar o mecanismo completo de
    /// <c>IUnitOfWork.ExecuteInSerializableTransactionAsync</c> do módulo
    /// Recommendations; revisitar se o abuso real aparecer.
    /// </summary>
    Task<int> CountByInvitedByUserIdSinceAsync(Guid invitedByUserId, DateTime sinceUtc, CancellationToken cancellationToken = default);

    /// <summary>React Native: tela "Convidar prestador" — histórico "convites enviados", mais recente primeiro.</summary>
    Task<IReadOnlyList<ProfessionalInvitation>> ListByInvitedByUserIdAsync(Guid invitedByUserId, CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalInvitation invitation, CancellationToken cancellationToken = default);
}
