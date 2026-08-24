namespace Alilu.BuildingBlocks.Domain;

/// <summary>
/// Marcador para eventos de domínio. Os módulos de negócio irão
/// implementar eventos concretos (ex.: AgendamentoConfirmado) quando
/// forem construídos.
/// </summary>
public interface IDomainEvent
{
    DateTime OccurredOnUtc { get; }
}
