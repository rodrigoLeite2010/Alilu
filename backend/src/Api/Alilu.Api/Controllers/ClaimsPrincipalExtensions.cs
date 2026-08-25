using System.Security.Claims;
using Alilu.Modules.Condominium.Application;

namespace Alilu.Api.Controllers;

/// <summary>
/// Extrai o papel do usuário autenticado (claim de papel do JWT — ver
/// <c>JwtTokenGenerator</c> no módulo Identity) como
/// <see cref="CondominiumRequesterRole"/>, para os controllers
/// administrativos do módulo Condominium. Fica em um helper compartilhado
/// para não duplicar a mesma lógica em cada controller (ver
/// <see cref="CondominiumsController"/> e
/// <see cref="CondominiumInvitationsController"/>).
/// </summary>
public static class ClaimsPrincipalExtensions
{
    public static CondominiumRequesterRole GetCondominiumRequesterRole(this ClaimsPrincipal user)
    {
        var roleClaim = user.FindFirstValue(ClaimTypes.Role);

        if (roleClaim is null || !Enum.TryParse<CondominiumRequesterRole>(roleClaim, out var role))
        {
            // Não deveria acontecer para um token emitido por este próprio
            // Api (ver JwtTokenGenerator), mas cobre tokens malformados que
            // por algum motivo passaram na validação de assinatura.
            throw new UnauthorizedAccessException("O token não contém um papel de usuário válido.");
        }

        return role;
    }
}
