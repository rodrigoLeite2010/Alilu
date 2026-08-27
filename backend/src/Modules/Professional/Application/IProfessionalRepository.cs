using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Porta de persistência de <see cref="Domain.Professional"/>. Implementada
/// em Infrastructure (EF Core); aqui é só a abstração usada pela
/// Application.
/// </summary>
public interface IProfessionalRepository
{
    Task<Domain.Professional?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Usado tanto para resolver o perfil do usuário autenticado (self-service) quanto para checar duplicidade ao criar um novo perfil.</summary>
    Task<Domain.Professional?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Diretório público (ProfessionalListScreen) — só perfis
    /// <see cref="ProfessionalStatus.Active"/>; quando
    /// <paramref name="serviceCategoryId"/> é informado, só profissionais
    /// com ao menos um serviço ativo naquela especialidade (join com
    /// <see cref="ProfessionalService"/>).
    ///
    /// Etapa 23 — BUG REAL encontrado por Rodrigo: "Ver todos os
    /// profissionais" dentro de uma categoria-pai já escolhida (ex.:
    /// "Piscina", em ServiceCategoryScreen) navegava sem filtro nenhum,
    /// mostrando qualquer profissional ativo (inclusive de outra categoria,
    /// ex. diarista). <paramref name="professionalCategoryId"/>, quando
    /// informado e <paramref name="serviceCategoryId"/> NÃO for informado,
    /// filtra por qualquer especialidade que pertença àquela categoria-pai
    /// (join com <see cref="ServiceCategory.CategoryId"/>) — cobre o "ver
    /// todos" de dentro de uma categoria, sem exigir uma especialidade
    /// específica.
    /// </summary>
    ///
    /// <remarks>
    /// Etapa 23 (pedido de Rodrigo: "buscar profissional pelo nome") —
    /// <paramref name="name"/>, quando informado, filtra por
    /// <see cref="Domain.Professional.DisplayName"/> contendo o texto (sem
    /// diferenciar maiúsculas/minúsculas), combinável com qualquer um dos
    /// dois filtros de categoria acima.
    /// </remarks>
    Task<IReadOnlyList<Domain.Professional>> ListActiveAsync(
        Guid? serviceCategoryId,
        Guid? professionalCategoryId = null,
        string? name = null,
        CancellationToken cancellationToken = default);

    Task AddAsync(Domain.Professional professional, CancellationToken cancellationToken = default);
}
