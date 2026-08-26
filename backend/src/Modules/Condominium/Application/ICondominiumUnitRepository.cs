using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Porta de persistência de <see cref="CondominiumUnit"/>.</summary>
public interface ICondominiumUnitRepository
{
    Task<CondominiumUnit?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CondominiumUnit>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary><paramref name="excludingUnitId"/> (Etapa 12) permite reaproveitar esta checagem em "editar unidade" — o código pode continuar igual ao da própria unidade sendo editada, só é duplicidade se pertencer a OUTRA unidade.</summary>
    Task<bool> ExistsByCondominiumIdAndCodeAsync(Guid condominiumId, string code, Guid? excludingUnitId = null, CancellationToken cancellationToken = default);

    Task AddAsync(CondominiumUnit unit, CancellationToken cancellationToken = default);
}
