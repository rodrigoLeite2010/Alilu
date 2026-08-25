namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Resgate de convite (PROMPT 05, FLUXO 1) — self-service, sem checagem de
/// papel administrativo (qualquer usuário autenticado pode tentar resgatar
/// um convite). Interface separada de <see cref="ICondominiumService"/>
/// (que é só administrativo) pelo mesmo motivo do módulo Identity ter
/// <c>IAuthService</c> à parte de operações administrativas: são
/// consumidores diferentes com necessidades de autorização diferentes.
///
/// SEGURANÇA (PROMPT 05 — "nunca confiar em condominiumId/unitId vindos do
/// cliente"): por isso <see cref="ValidateInvitationAsync"/> não recebe
/// nem devolve nada que o cliente possa "escolher" — só o código digitado
/// (e opcionalmente o e-mail do próprio usuário autenticado, para a
/// checagem "quando aplicável"). O condomínio e a unidade do
/// <see cref="InvitationValidationResult"/> devolvido são sempre os que o
/// próprio convite já tinha gravado (ver <c>CondominiumInvitation</c>),
/// nunca calculados a partir de nada que o chamador informou.
///
/// PADRÃO DE DUAS FASES (evita "queimar" um convite à toa): esta
/// interface separa validar (<see cref="ValidateInvitationAsync"/>, só
/// leitura) de marcar como usado (<see cref="MarkInvitationAsUsedAsync"/>,
/// escrita). Quem orquestra as duas fases é a Api (composição raiz) — ela
/// só chama <see cref="MarkInvitationAsUsedAsync"/> depois que o módulo
/// Resident confirma que o <c>CondominiumMembership</c> foi criado com
/// sucesso; assim, se a criação do vínculo falhar por qualquer motivo, o
/// convite continua válido e a pessoa pode tentar de novo.
/// </summary>
public interface IInvitationRedemptionService
{
    /// <summary>
    /// Executa os passos 1 a 6 do FLUXO 1 (PROMPT 05): validar o código,
    /// checar validade/expiração, checar que ainda não foi usado, checar
    /// o e-mail (só quando <paramref name="email"/> é informado) e
    /// devolver o condomínio/unidade que o convite já definia (passos 5 e
    /// 6 — "identificar condomínio"/"identificar unidade").
    /// </summary>
    Task<InvitationValidationResult> ValidateInvitationAsync(
        string code,
        string? email,
        CancellationToken cancellationToken = default);

    /// <summary>Passo 8 do FLUXO 1 — só deve ser chamado depois que o passo 7 (criar o Membership) já foi concluído com sucesso.</summary>
    Task MarkInvitationAsUsedAsync(Guid invitationId, CancellationToken cancellationToken = default);
}
