using System.Security.Claims;
using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Resident.Application;

namespace Alilu.Api.Controllers;

/// <summary>
/// Extrai claims do usuário autenticado (JWT — ver <c>JwtTokenGenerator</c>
/// no módulo Identity) para os tipos de papel próprios de cada módulo, e o
/// próprio Id do usuário. Fica em um helper compartilhado para não
/// duplicar a mesma lógica em cada controller.
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

    /// <summary>Mesmo claim de papel acima, só que como <see cref="ResidentRequesterRole"/> — usado pelos controllers do módulo Resident (PROMPT 05).</summary>
    public static ResidentRequesterRole GetResidentRequesterRole(this ClaimsPrincipal user)
    {
        var roleClaim = user.FindFirstValue(ClaimTypes.Role);

        if (roleClaim is null || !Enum.TryParse<ResidentRequesterRole>(roleClaim, out var role))
        {
            throw new UnauthorizedAccessException("O token não contém um papel de usuário válido.");
        }

        return role;
    }

    /// <summary>
    /// O Id (subject) do usuário autenticado — mesmo claim que
    /// <c>AuthController.GetAuthenticatedUserId</c> já extraía de forma
    /// privada; exposto aqui como extensão compartilhada porque os novos
    /// controllers do módulo Resident (PROMPT 05) também precisam dele
    /// (todo caso de uso self-service é sempre restrito ao próprio
    /// usuário — nunca recebe um userId vindo do corpo da requisição).
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var subjectClaim = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub");

        if (subjectClaim is null || !Guid.TryParse(subjectClaim, out var userId))
        {
            throw new UnauthorizedAccessException("O token não contém um identificador de usuário válido.");
        }

        return userId;
    }
}
