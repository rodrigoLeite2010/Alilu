using System.Linq;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Normaliza números de telefone brasileiros para o formato E.164 exigido
/// pela API da Twilio em ambos os canais — <c>whatsapp:+&lt;E.164&gt;</c>
/// (WhatsApp) e <c>+&lt;E.164&gt;</c> puro (SMS); ver skill
/// twilio-whatsapp-send-message: "all numbers use whatsapp:+E.164 prefix".
///
/// A tela "Convidar prestador" (React Native) pede só "Telefone (com
/// DDD)" — o morador digita algo como "11987930848", sem "+55" e sem
/// pontuação. Este é o único lugar onde isso é convertido; o valor
/// ORIGINAL digitado continua gravado em <see cref="Alilu.Modules.Professional.Domain.ProfessionalInvitation.Phone"/>
/// (é o que aparece no histórico "convites enviados") — esta função só
/// formata a CÓPIA usada na chamada HTTP à Twilio, dentro dos senders.
///
/// CONTRATO: nunca lança — mesmo contrato de nunca-lança dos senders que a
/// usam (<see cref="TwilioWhatsAppSender"/>/<see cref="TwilioSmsSender"/>).
/// Na dúvida (número fora dos formatos abaixo), devolve o melhor palpite
/// e deixa a própria Twilio rejeitar — isso já é tratado como falha
/// normal do canal (log + <c>false</c>), nunca derruba o convite.
/// </summary>
internal static class BrazilianPhoneNumberFormatter
{
    public static string ToE164(string phoneNumber)
    {
        var digits = new string(phoneNumber.Where(char.IsDigit).ToArray());

        if (digits.Length == 0)
        {
            return phoneNumber;
        }

        // Já vem com "55" (código do país) + DDD (2) + número (8 ou 9
        // dígitos) = 12 ou 13 dígitos no total.
        if ((digits.Length == 12 || digits.Length == 13) && digits.StartsWith("55"))
        {
            return $"+{digits}";
        }

        // Caso mais comum, exatamente o que a tela pede: DDD (2) +
        // número (8 ou 9), sem código do país.
        if (digits.Length == 10 || digits.Length == 11)
        {
            return $"+55{digits}";
        }

        // Formato inesperado — melhor palpite.
        return digits.StartsWith("55") ? $"+{digits}" : $"+55{digits}";
    }
}
