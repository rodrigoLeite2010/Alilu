using System.Security.Claims;
using Alilu.Api.Services;
using Alilu.Modules.Identity.Application;
using Alilu.Modules.Professional.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints de autenticação do módulo Identity (PROMPT 03). Não sabe
/// nada de EF Core, JWT ou hashing — apenas traduz HTTP &lt;-&gt;
/// <see cref="IAuthService"/> e mapeia exceções de aplicação para status
/// HTTP (ver <see cref="Middleware.ExceptionHandlingMiddleware"/>).
///
/// Ponto de COMPOSIÇÃO desde a Etapa 21 (foto pessoal): <see cref="SetMyPhoto"/>/
/// <see cref="RemoveMyPhoto"/> também injetam <see cref="IProfessionalProfileService"/>
/// (módulo Professional) — decisão confirmada com Rodrigo (não uma regra
/// pré-existente): quem também é profissional tem UMA ÚNICA foto, não duas
/// independentes, então trocar a foto pessoal aqui espelha automaticamente
/// em <c>Professional.PhotoUrl</c> (o campo já usado pelo diretório público
/// que os moradores veem, existente desde o PROMPT 06 mas nunca antes
/// preenchido por nenhuma tela). Nenhum dos dois módulos poderia fazer essa
/// composição sozinho (regra do PROMPT 01) — só a Api.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IAuthService authService,
    IUserPhotoStorage photoStorage,
    IProfessionalProfileService professionalProfileService) : ControllerBase
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

    /// <summary>
    /// Define a foto pessoal do usuário autenticado (Etapa 21) — recebe a
    /// imagem já recortada/comprimida pelo próprio celular (React Native:
    /// `expo-image-picker` com `allowsEditing`) como base64, nunca um
    /// arquivo bruto sem tratamento. Sobrescreve qualquer foto anterior.
    /// </summary>
    [HttpPut("me/photo")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> SetMyPhoto([FromBody] SetPhotoBody body, CancellationToken cancellationToken)
    {
        var userId = GetAuthenticatedUserId();

        var relativePath = await photoStorage.SaveAsync(userId, body.Base64Image, body.ContentType, cancellationToken);
        var absoluteUrl = $"{Request.Scheme}://{Request.Host}{relativePath}";

        var updatedUser = await authService.SetMyPhotoAsync(userId, absoluteUrl, cancellationToken);
        await MirrorPhotoToProfessionalProfileAsync(userId, absoluteUrl, cancellationToken);

        return Ok(updatedUser);
    }

    /// <summary>Remove a foto pessoal do usuário autenticado — volta ao fallback de iniciais (React Native: componente `Avatar`).</summary>
    [HttpDelete("me/photo")]
    [Authorize]
    public async Task<ActionResult<UserResponse>> RemoveMyPhoto(CancellationToken cancellationToken)
    {
        var userId = GetAuthenticatedUserId();

        photoStorage.Delete(userId);
        var updatedUser = await authService.RemoveMyPhotoAsync(userId, cancellationToken);
        await MirrorPhotoToProfessionalProfileAsync(userId, null, cancellationToken);

        return Ok(updatedUser);
    }

    /// <summary>
    /// Composição descrita no comentário da classe: se este usuário também
    /// tiver um perfil profissional, reaproveita
    /// <see cref="IProfessionalProfileService.UpdateMyProfileAsync"/> (já
    /// existente desde o PROMPT 06) passando os demais campos inalterados —
    /// evita duplicar em Professional a lógica de "definir só a foto".
    /// No-op silencioso para quem não é profissional (a grande maioria dos
    /// usuários que vão usar este endpoint).
    /// </summary>
    private async Task MirrorPhotoToProfessionalProfileAsync(Guid userId, string? photoUrl, CancellationToken cancellationToken)
    {
        var professionalProfile = await professionalProfileService.GetMyProfileAsync(userId, cancellationToken);
        if (professionalProfile is null)
        {
            return;
        }

        await professionalProfileService.UpdateMyProfileAsync(
            userId,
            professionalProfile.DisplayName,
            professionalProfile.Description,
            professionalProfile.Phone,
            photoUrl,
            cancellationToken);
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

/// <summary>Corpo de PUT .../me/photo — imagem já recortada/comprimida pelo cliente, como base64.</summary>
public sealed record SetPhotoBody(string Base64Image, string ContentType);
