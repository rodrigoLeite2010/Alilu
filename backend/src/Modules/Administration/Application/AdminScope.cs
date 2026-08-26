namespace Alilu.Modules.Administration.Application;

/// <summary>
/// O escopo de administração já resolvido no backend para o usuário
/// autenticado (PROMPT 12, AUTORIZAÇÃO: "Nunca confiar no condominiumId
/// enviado pelo frontend. Obter o escopo do usuário autenticado no
/// backend."). Devolvido por <see cref="IAdminScopeService.ResolveScopeAsync"/>
/// — é o único tipo deste módulo que a Api usa diretamente ao chamar os
/// métodos administrativos dos demais módulos (Resident/Professional/
/// Condominium/Recommendations): eles não precisam saber nada sobre
/// <c>CondominiumAdministrator</c>, só ganham um parâmetro comum
/// <c>Guid</c>/<c>Guid?</c> condominiumId — ver ARCHITECTURE.md, "Etapa 12".
///
/// <see cref="CondominiumId"/> nulo significa SuperAdmin — "SuperAdmin pode
/// administrar todos os condomínios" (acesso irrestrito). Não-nulo é o
/// único condomínio que um CondominiumAdmin pode acessar.
/// </summary>
public sealed record AdminScope(Guid AdminUserId, Guid? CondominiumId)
{
    public bool IsGlobal => CondominiumId is null;

    /// <summary>Confere se este escopo alcança <paramref name="targetCondominiumId"/> — SuperAdmin sempre alcança, CondominiumAdmin só o próprio.</summary>
    public bool CanAccess(Guid targetCondominiumId) => IsGlobal || CondominiumId == targetCondominiumId;

    /// <summary>
    /// Mesma checagem de <see cref="CanAccess"/>, mas já lançando quando o
    /// acesso é negado — usada pela Api reaproveitando uma entidade JÁ
    /// buscada pelo módulo de negócio (ex.: o <c>CondominiumMembership</c>
    /// que <c>ApproveAsync</c> já carregou), sem nenhuma query extra.
    /// <paramref name="exceptionFactory"/> deixa cada módulo chamador lançar
    /// a PRÓPRIA <c>InsufficientPermissionsException</c> (já mapeada para
    /// 403 em <c>ExceptionHandlingMiddleware</c>) — este método nunca lança
    /// um tipo de exceção do módulo Administration para dentro de outro
    /// módulo.
    /// </summary>
    public void EnsureCanAccess(Guid targetCondominiumId, Func<Exception> exceptionFactory)
    {
        if (!CanAccess(targetCondominiumId))
        {
            throw exceptionFactory();
        }
    }
}
