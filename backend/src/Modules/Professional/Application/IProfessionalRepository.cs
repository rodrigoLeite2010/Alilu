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

    /// <summary>Diretório público (ProfessionalListScreen) — só perfis <see cref="ProfessionalStatus.Active"/>; quando <paramref name="serviceCategoryId"/> é informado, só profissionais com ao menos um serviço ativo naquela categoria (join com <see cref="ProfessionalService"/>).</summary>
    Task<IReadOnlyList<Domain.Professional>> ListActiveAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default);

    Task AddAsync(Domain.Professional professional, CancellationToken cancellationToken = default);
}
