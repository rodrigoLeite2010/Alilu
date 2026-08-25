namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Diretório público de condomínios/unidades (PROMPT 05, FLUXO 2 — "Não
/// encontrei minha unidade") — self-service, sem checagem de papel
/// administrativo, usado para o morador escolher condomínio/unidade na
/// tela ChooseCondominium/RequestResidentAccess (mobile) antes de enviar
/// uma solicitação de vínculo.
///
/// Só devolve/valida registros <c>Active</c> — um condomínio ou unidade
/// inativa não deve aparecer como opção nem ser aceita numa solicitação.
/// </summary>
public interface ICondominiumDirectoryService
{
    Task<IReadOnlyList<CondominiumSummaryResponse>> ListActiveCondominiumsAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CondominiumUnitSummaryResponse>> ListActiveUnitsAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Confirma que <paramref name="unitId"/> existe e pertence a
    /// <paramref name="condominiumId"/> — chamada pela Api antes de deixar
    /// o módulo Resident criar uma solicitação (PROMPT 05: "nunca confiar
    /// em condominiumId/unitId vindos do cliente" — aqui é onde essa
    /// desconfiança vira uma checagem de verdade). Lança as mesmas
    /// exceções de <see cref="ICondominiumService"/> quando algo não é
    /// encontrado/não bate (<see cref="CondominiumNotFoundException"/>,
    /// <see cref="CondominiumUnitNotFoundException"/>,
    /// <see cref="UnitDoesNotBelongToCondominiumException"/>).
    /// </summary>
    Task ValidateUnitAsync(Guid condominiumId, Guid unitId, CancellationToken cancellationToken = default);
}
