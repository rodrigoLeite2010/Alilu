namespace Alilu.Modules.Condominium.Domain;

/// <summary>
/// Situação estrutural da unidade (existe/está disponível para uso pelo
/// condomínio). Não confundir com ocupação por um morador — esse vínculo
/// pertence ao módulo Resident (ainda não implementado; ver PROMPT 04).
/// </summary>
public enum UnitStatus
{
    Active = 1,
    Inactive = 2,
}
