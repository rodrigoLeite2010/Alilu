using System.Security.Claims;
using Alilu.Modules.Identity.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints de autenticação do módulo Identity (PROMPT 03). Não sabe
/// nada de EF Core, JWT ou hashing — apenas traduz HTTP &lt;-&gt;
/// <see cref="IAuthService"/> e mapeia exceções de aplicação para status
/// HTTP (ver <see cref="Middleware.ExceptionHandlingMiddleware"/>).
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<UserResponse>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var user = await authService.RegisterAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, user);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthTokensResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var tokens = await authService.LoginAsync(request, cancellationToken);
        return Ok(tokens);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthTokensResponse>> Refresh(
        [FromBody] RefreshRequest request,
        CancellationToken cancellationToken)
    {
        var tokens = await authService.RefreshAsync(request, cancellationToken);
        return Ok(tokens);
    }

    [HttpPost("revoke")]
    [AllowAnonymous]
    public async Task<IActionResult> Revoke(
        [FromBody] RevokeRequest request,
        CancellationToken cancellationToken)
    {
        await authService.RevokeAsync(request, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Retorna os dados do usuário autenticado. Requer um access token
    /// válido (Authorization: Bearer ...) — não requer nenhum vínculo com
    /// condomínio, já que essa associação pertence ao módulo Resident
    /// (ainda não implementado; ver PROMPT 03).
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
    {
        var userId = GetAuthenticatedUserId();
        var user = await authService.GetMeAsync(userId, cancellationToken);
        return Ok(user);
    }

    private Guid GetAuthenticatedUserId()
    {
        var subjectClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (subjectClaim is null || !Guid.TryParse(subjectClaim, out var userId))
        {
            // Não deveria acontecer para um token emitido por este próprio
            // Api (ver JwtTokenGenerator), mas cobre tokens malformados que
            // por algum motivo passaram na validação de assinatura.
            throw new UnauthorizedAccessException("O token não contém um identificador de usuário válido.");
        }

        return userId;
    }
}
