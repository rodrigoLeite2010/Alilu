using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalCondominium"/>.</summary>
public interface IProfessionalCondominiumRepository
{
    Task<ProfessionalCondominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalCondominium>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>Checagem de duplicidade (ver <see cref="DuplicateProfessionalCondominiumException"/>) — Pending e Active contam como "já vinculado"; Rejected/Inactive não impedem uma nova tentativa.</summary>
    Task<bool> ExistsActiveOrPendingAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Fila de aprovação administrativa. <paramref name="condominiumId"/>
    /// (Etapa 12, opcional) filtra para um único condomínio — usado quando
    /// quem pede é um CondominiumAdmin (escopo resolvido pela Api); nulo
    /// lista de todos os condomínios (SuperAdmin).
    /// </summary>
    Task<IReadOnlyList<ProfessionalCondominium>> ListPendingAsync(Guid? condominiumId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Etapa 12 — todos os vínculos de um condomínio, qualquer status.
    /// Suporte necessário para "Profissionais: bloquear" (para achar o
    /// vínculo Active a bloquear) e para a contagem de "profissionais" do
    /// dashboard administrativo — não é, em si, um item separado da lista
    /// de FUNCIONALIDADES do prompt.
    /// </summary>
    Task<IReadOnlyList<ProfessionalCondominium>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalCondominium professionalCondominium, CancellationToken cancellationToken = default);
}
