using Alilu.Shared;

namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Unidade de um condomínio (ex.: apartamento, casa, salão comercial).
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>Condominium</c> aqui, só <see cref="CondominiumId"/> como valor
/// simples (mesma decisão de <c>RefreshToken</c> em relação a <c>User</c>
/// no módulo Identity: evita acoplar duas raízes de agregado por
/// navegação EF; a existência do condomínio e a unicidade do código dentro
/// dele são conferidas pela Application antes de persistir, e reforçadas
/// por um índice único composto em Infrastructure).
/// </summary>
public sealed class CondominiumUnit : AggregateRoot
{
    public Guid CondominiumId { get; private set; }
    public string Code { get; private set; }
    public UnitType Type { get; private set; }
    public UnitStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }

#pragma warning disable CS8618
    private CondominiumUnit()
    {
    }
#pragma warning restore CS8618

    private CondominiumUnit(Guid id, Guid condominiumId, string code, UnitType type)
        : base(id)
    {
        CondominiumId = condominiumId;
        Code = code;
        Type = type;
        Status = UnitStatus.Active;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Registra uma nova unidade. A unicidade do <paramref name="code"/>
    /// dentro do condomínio é responsabilidade da Application (ver
    /// <c>ICondominiumUnitRepository.ExistsByCondominiumIdAndCodeAsync</c>) —
    /// esta entidade, isolada, não tem como saber sobre as demais unidades.
    /// </summary>
    public static CondominiumUnit Register(Guid condominiumId, string code, UnitType type)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("A unidade precisa de um condomínio válido.");
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("O código da unidade não pode ser vazio.");
        }

        var trimmedCode = code.Trim();
        if (trimmedCode.Length > 20)
        {
            throw new DomainException("O código da unidade não pode ter mais de 20 caracteres.");
        }

        return new CondominiumUnit(Guid.NewGuid(), condominiumId, trimmedCode, type);
    }

    public bool IsActive => Status == UnitStatus.Active;

    public void Deactivate() => Status = UnitStatus.Inactive;

    public void Activate() => Status = UnitStatus.Active;
}
