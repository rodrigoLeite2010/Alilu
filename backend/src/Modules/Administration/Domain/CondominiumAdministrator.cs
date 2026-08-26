using Alilu.Shared;

namespace Alilu.Modules.Administration.Domain;

/// <summary>
/// "CondominiumAdmin somente pode administrar seu próprio condomínio"
/// (PROMPT 12, seção AUTORIZAÇÃO) — este vínculo é a fonte de verdade de
/// QUAL condomínio um usuário com papel <c>CondominiumAdmin</c>
/// administra. Sem esta entidade, não havia nenhum jeito de o backend
/// responder "qual é o escopo deste admin" — <c>Identity.User.Role</c>
/// (PROMPT 03) só guarda o PAPEL ("CondominiumAdmin"), nunca um
/// condomínio; o próprio comentário de <c>UserRole</c> já deixava isso
/// reservado para uma etapa administrativa futura. Ver
/// <c>Application.IAdminScopeService</c> para como isto vira,
/// efetivamente, "nunca confiar no condominiumId enviado pelo frontend —
/// obter o escopo do usuário autenticado no backend".
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>User</c> (Identity) nem <c>Condominium</c> (módulo Condominium), só
/// os Ids como valores simples (mesma decisão de todas as entidades dos
/// módulos anteriores — nenhum módulo referencia outro, PROMPT 01). A
/// existência/papel do usuário e a existência do condomínio são
/// confirmadas pela Api (composição raiz) antes de persistir — ver
/// <c>AdminCondominiumAdministratorsController</c>.
///
/// DECISÃO DE ESCOPO (MVP): modela UM condomínio por administrador — o
/// prompt não pede (nem o fluxo atual de cadastro de administradores,
/// ainda manual via SQL, sugere) suporte a um mesmo <c>CondominiumAdmin</c>
/// administrando vários condomínios ao mesmo tempo. <see cref="Assign"/>
/// faz upsert (reatribuir substitui o condomínio anterior) — mesma
/// filosofia de <c>Notifications.DeviceToken</c> (Etapa 11): um valor por
/// usuário, a atribuição mais recente sempre vale.
/// </summary>
public sealed class CondominiumAdministrator : AggregateRoot
{
    public Guid UserId { get; private set; }
    public Guid CondominiumId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

#pragma warning disable CS8618
    private CondominiumAdministrator()
    {
    }
#pragma warning restore CS8618

    private CondominiumAdministrator(Guid id, Guid userId, Guid condominiumId)
        : base(id)
    {
        UserId = userId;
        CondominiumId = condominiumId;
        var now = DateTime.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;
    }

    /// <summary>Cria a atribuição inicial (usada quando o repositório confirma que este usuário ainda não tinha nenhuma — ver <c>AdminScopeService.AssignAsync</c>, que decide entre isto e <see cref="Reassign"/>).</summary>
    public static CondominiumAdministrator Assign(Guid userId, Guid condominiumId)
    {
        ValidateIds(userId, condominiumId);

        return new CondominiumAdministrator(Guid.NewGuid(), userId, condominiumId);
    }

    /// <summary>Upsert — troca o condomínio administrado por este usuário (ver decisão de escopo na doc da classe).</summary>
    public void Reassign(Guid condominiumId)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("É necessário informar um condomínio válido.");
        }

        CondominiumId = condominiumId;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateIds(Guid userId, Guid condominiumId)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("A atribuição precisa de um usuário válido.");
        }

        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("A atribuição precisa de um condomínio válido.");
        }
    }
}
