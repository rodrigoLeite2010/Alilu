namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Casos de uso administrativos deste módulo — decidir sobre solicitações
/// de atendimento a um condomínio (React Native, profissional:
/// "solicitar atendimento em condomínios"; alguém precisa aprovar/rejeitar
/// essa fila, mesmo raciocínio de
/// <c>Alilu.Modules.Resident.Application.IMembershipAdministrationService</c>
/// para o FLUXO 2 de solicitação de acesso) — mais, desde a Etapa 12
/// (PROMPT 12), bloquear um vínculo já ativo e associar um profissional
/// diretamente (sem passar por uma solicitação). Toda operação aqui começa
/// com uma checagem de papel (<c>EnsureIsAdmin</c>), mesmo padrão dos demais
/// módulos.
///
/// Etapa 12 acrescentou <c>scopeCondominiumId</c> a cada operação —
/// resolvido pela Api via <c>Administration.Application.IAdminScopeService</c>
/// (nunca confiando no que o frontend envia). Parâmetro opcional (nulo = sem
/// restrição, comportamento das etapas anteriores) para não quebrar nenhum
/// chamador existente — SuperAdmin sempre passa nulo.
/// </summary>
public interface IProfessionalAdministrationService
{
    /// <summary>Fila de solicitações aguardando decisão.</summary>
    Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListPendingCondominiumRequestsAsync(
        ProfessionalRequesterRole requesterRole,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 12 — todos os vínculos (qualquer status) de um condomínio;
    /// suporte necessário para "bloquear" (achar o vínculo Active) e para o
    /// dashboard administrativo, não um item separado da lista de
    /// FUNCIONALIDADES do prompt.
    /// </summary>
    Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListByCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    Task<ProfessionalCondominiumResponse> ApproveCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    Task<ProfessionalCondominiumResponse> RejectCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// "Profissionais: bloquear" (PROMPT 12) — desativa o vínculo
    /// profissional↔condomínio (<see cref="Domain.ProfessionalCondominium.Deactivate"/>):
    /// o profissional para de atender ESTE condomínio especificamente.
    /// Decisão de escopo (ver README): NÃO desativa o perfil global do
    /// profissional (<see cref="Domain.Professional.Deactivate"/>) — isso
    /// afetaria indevidamente outros condomínios que o mesmo profissional
    /// também atende, fora do escopo de quem está bloqueando.
    /// </summary>
    Task<ProfessionalCondominiumResponse> BlockAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// "Profissionais: associar ao condomínio" (PROMPT 12) — cria o vínculo
    /// já <see cref="Domain.ProfessionalCondominiumStatus.Active"/>, com
    /// <see cref="Domain.ProfessionalCondominiumSource.AdminApproved"/>
    /// (primeiro caminho de código real para este valor, reservado desde a
    /// Etapa 06). Diferente de "aprovar" — aqui não existe uma solicitação
    /// prévia do profissional, o administrador cadastra o vínculo direto.
    /// </summary>
    Task<ProfessionalCondominiumResponse> AssociateAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalId,
        Guid condominiumId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default);
}
