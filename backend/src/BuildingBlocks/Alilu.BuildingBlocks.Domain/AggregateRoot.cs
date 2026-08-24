namespace Alilu.BuildingBlocks.Domain;

/// <summary>
/// Classe base para raízes de agregado (aggregate roots).
/// Uma raiz de agregado é o único ponto de entrada para modificar o estado
/// de um agregado, protegendo suas invariantes de negócio.
/// </summary>
public abstract class AggregateRoot : Entity
{
    private readonly List<IDomainEvent> _domainEvents = new();

    protected AggregateRoot()
    {
    }

    protected AggregateRoot(Guid id)
        : base(id)
    {
    }

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void RaiseDomainEvent(IDomainEvent domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}
