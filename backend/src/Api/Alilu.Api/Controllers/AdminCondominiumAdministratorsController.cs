using Alilu.Modules.Administration.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints administrativos do próprio módulo Administration (Etapa 12 /
/// PROMPT 12) — SuperAdmin-only, sem exceção: é aqui que um SuperAdmin
/// vincula (ou revincula — upsert, ver <c>Domain.CondominiumAdministrator.Reassign</c>)
/// um usuário CondominiumAdmin a UM condomínio, criando o escopo que
/// <see cref="IAdminScopeService.ResolveScopeAsync"/> depois resolve em
/// todo endpoint administrativo dos demais módulos.
///
/// Sem isto, nenhum CondominiumAdmin recém-registrado teria como
/// administrar coisa alguma — <c>Identity.User.Role</c> só guarda o papel,
/// nunca um condomínio (ver README do módulo Administration para o passo a
/// passo operacional).
/// </summary>
[ApiController]
[Route("api/admin/condominium-administrators")]
[Authorize(Roles = "SuperAdmin")]
public sealed class AdminCondominiumAdministratorsController(IAdminScopeService adminScopeService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CondominiumAdministratorResponse>>> List(CancellationToken cancellationToken)
    {
        var assignments = await adminScopeService.ListAssignmentsAsync(
            User.GetAdministrationRequesterRole(), cancellationToken);
        return Ok(assignments);
    }

    [HttpPost]
    public async Task<ActionResult<CondominiumAdministratorResponse>> Assign(
        [FromBody] AssignCondominiumAdministratorBody body,
        CancellationToken cancellationToken)
    {
        var assignment = await adminScopeService.AssignAsync(
            User.GetAdministrationRequesterRole(), body.UserId, body.CondominiumId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, assignment);
    }
}

/// <summary>
/// Corpo de POST /api/admin/condominium-administrators. A Api (composição
/// raiz) não confere aqui que <see cref="UserId"/> é de fato um usuário com
/// papel CondominiumAdmin nem que <see cref="CondominiumId"/> existe — isso
/// fica para uma etapa futura de validação cruzada, se pedido; por ora, o
/// SuperAdmin que usa este endpoint é responsável por informar valores
/// válidos (mesma confiança já dada a um SuperAdmin em outras operações
/// irrestritas desta Api).
/// </summary>
public sealed record AssignCondominiumAdministratorBody(Guid UserId, Guid CondominiumId);
