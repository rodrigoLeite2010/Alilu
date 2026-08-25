namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Papéis de usuário no ALILU (PROMPT 03).
///
/// Apenas <see cref="Resident"/> e <see cref="Professional"/> podem ser
/// escolhidos em auto-cadastro público (ver <c>User.Register</c>).
/// <see cref="CondominiumAdmin"/> e <see cref="SuperAdmin"/> são papéis
/// privilegiados — a atribuição deles fica para uma etapa futura (fluxo
/// administrativo), nunca a partir de dado enviado livremente pelo app.
/// </summary>
public enum UserRole
{
    Resident = 1,
    Professional = 2,
    CondominiumAdmin = 3,
    SuperAdmin = 4,
}
