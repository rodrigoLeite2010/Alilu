namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Confirma (persiste) as mudanças feitas nesta unidade de trabalho.
/// Necessário porque os repositórios deste módulo não salvam a cada
/// chamada — <see cref="IRefreshTokenRepository.GetByTokenHashAsync"/>
/// retorna uma entidade rastreada (tracked) que pode ser mutada (ex.:
/// <c>Revoke()</c>) e só é persistida quando <see cref="SaveChangesAsync"/>
/// é chamado, no fim do caso de uso.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
