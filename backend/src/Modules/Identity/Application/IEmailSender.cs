namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Porta preparada para o fluxo de recuperação de senha (PROMPT 03:
/// "preparar recuperação de senha, mas não implementar envio de e-mail
/// ainda"). Nenhum caso de uso desta etapa a invoca ainda — o envio real
/// de e-mail (e o restante do fluxo de "esqueci minha senha": gerar
/// token, endpoint de confirmação) fica para uma etapa futura.
///
/// A implementação registrada em Infrastructure nesta etapa é um NoOp
/// (loga em vez de enviar).
/// </summary>
public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default);
}
