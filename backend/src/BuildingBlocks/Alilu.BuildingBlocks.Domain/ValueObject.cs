namespace Alilu.BuildingBlocks.Domain;

/// <summary>
/// Classe base para objetos de valor (value objects).
/// Um objeto de valor não possui identidade própria: sua igualdade é
/// determinada pelos seus componentes (ex.: um Endereço, um Período).
/// </summary>
public abstract class ValueObject : IEquatable<ValueObject>
{
    protected abstract IEnumerable<object?> GetEqualityComponents();

    public bool Equals(ValueObject? other)
    {
        if (other is null || GetType() != other.GetType())
        {
            return false;
        }

        return GetEqualityComponents().SequenceEqual(other.GetEqualityComponents());
    }

    public override bool Equals(object? obj) => Equals(obj as ValueObject);

    public override int GetHashCode()
    {
        return GetEqualityComponents()
            .Aggregate(0, (hash, component) => HashCode.Combine(hash, component));
    }

    public static bool operator ==(ValueObject? left, ValueObject? right) => Equals(left, right);

    public static bool operator !=(ValueObject? left, ValueObject? right) => !Equals(left, right);
}
