namespace Alilu.Shared;

/// <summary>
/// Exceção lançada quando uma regra de negócio/invariante do domínio é violada.
/// Deve ser usada pelas entidades e agregados dos módulos de negócio
/// (ex.: "Agendamento não pode ser feito em data passada").
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message)
        : base(message)
    {
    }

    public DomainException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
