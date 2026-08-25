using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>Implementação de <see cref="IInvitationRedemptionService"/> — ver comentário de segurança/design lá.</summary>
public sealed class InvitationRedemptionService(
    ICondominiumInvitationRepository invitationRepository,
    IInvitationCodeGenerator invitationCodeGenerator,
    IUnitOfWork unitOfWork) : IInvitationRedemptionService
{
    public async Task<InvitationValidationResult> ValidateInvitationAsync(
        string code,
        string? email,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new InvitationNotFoundException();
        }

        // 1) validar o código — comparado sempre pelo hash, nunca em texto
        // puro (mesma técnica de RefreshToken no módulo Identity).
        var codeHash = invitationCodeGenerator.Hash(code.Trim());
        var invitation = await invitationRepository.GetByCodeHashAsync(codeHash, cancellationToken)
            ?? throw new InvitationNotFoundException();

        // 3) checar que ainda não foi usado (checado antes da expiração de
        // propósito: um convite já usado deve informar "já foi utilizado",
        // não "expirou", mesmo que as duas coisas sejam verdade).
        if (invitation.IsUsed)
        {
            throw new InvitationAlreadyUsedException();
        }

        // 2) checar validade/expiração.
        if (invitation.IsExpired)
        {
            throw new InvitationExpiredException();
        }

        // 4) checar e-mail — "quando aplicável": só quando o chamador
        // informou um e-mail (o app envia o e-mail do próprio usuário
        // autenticado; comparação sem diferenciar maiúsculas/minúsculas,
        // mesmo padrão de Email.cs no módulo Identity).
        if (!string.IsNullOrWhiteSpace(email) &&
            !string.Equals(invitation.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            throw new InvitationEmailMismatchException();
        }

        // 5 e 6) identificar condomínio/unidade — sempre os do próprio
        // convite, nunca algo vindo do chamador (ver comentário de
        // segurança na interface).
        return new InvitationValidationResult(invitation.Id, invitation.CondominiumId, invitation.UnitId, invitation.Email);
    }

    public async Task MarkInvitationAsUsedAsync(Guid invitationId, CancellationToken cancellationToken = default)
    {
        var invitation = await invitationRepository.GetByIdAsync(invitationId, cancellationToken)
            ?? throw new InvitationNotFoundException();

        invitation.MarkAsUsed();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
