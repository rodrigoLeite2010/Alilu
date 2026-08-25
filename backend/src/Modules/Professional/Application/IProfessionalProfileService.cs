namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Casos de uso self-service deste módulo — qualquer usuário autenticado
/// pode chamar, sempre restrito ao próprio <c>userId</c> (não recebe papel
/// nenhum para checar, ao contrário de <see cref="IProfessionalAdministrationService"/> —
/// "seguro por construção", mesma filosofia de
/// <c>Alilu.Modules.Resident.Application.IMembershipService</c>).
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar o módulo Condominium. Por isso <see cref="RequestCondominiumAsync"/>
/// recebe um <c>condominiumId</c> já validado por quem chamou — a Api
/// (composição raiz), que confirma a existência do condomínio via
/// <c>ICondominiumDirectoryService.ValidateCondominiumAsync</c> (módulo
/// Condominium) antes de chamar este método — ver
/// <c>ProfessionalProfileController</c>.
/// </summary>
public interface IProfessionalProfileService
{
    /// <summary>O perfil profissional do usuário, se houver — usado para o gate do app (React Native: `(professional)/index.tsx`) decidir entre mostrar o formulário de criação ou o próprio perfil.</summary>
    Task<ProfessionalResponse?> GetMyProfileAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Cria o perfil profissional do usuário — um usuário só pode ter um (ver <see cref="ProfessionalAlreadyExistsException"/>).</summary>
    Task<ProfessionalResponse> CreateProfileAsync(
        Guid userId,
        string displayName,
        string? description,
        string? phone,
        string? photoUrl,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalEditScreen — "editar perfil".</summary>
    Task<ProfessionalResponse> UpdateMyProfileAsync(
        Guid userId,
        string displayName,
        string? description,
        string? phone,
        string? photoUrl,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalServiceResponse>> ListMyServicesAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalEditScreen — "selecionar serviços" (adicionar). Valida que a categoria existe e está ativa, e que o profissional ainda não tem um serviço ativo nela.</summary>
    Task<ProfessionalServiceResponse> AddMyServiceAsync(
        Guid userId,
        Guid serviceCategoryId,
        string? description,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalEditScreen — "selecionar serviços" (remover). Desativação lógica, não exclusão.</summary>
    Task RemoveMyServiceAsync(Guid userId, Guid professionalServiceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListMyCondominiumsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// React Native: "solicitar atendimento em condomínios". O vínculo
    /// nasce Pending, aguardando aprovação administrativa (ver
    /// <see cref="IProfessionalAdministrationService"/>).
    /// <paramref name="condominiumId"/> já deve ter sido confirmado por
    /// <c>ICondominiumDirectoryService.ValidateCondominiumAsync</c> (módulo
    /// Condominium, chamado pela Api antes deste método).
    /// </summary>
    Task<ProfessionalCondominiumResponse> RequestCondominiumAsync(
        Guid userId,
        Guid condominiumId,
        CancellationToken cancellationToken = default);
}
