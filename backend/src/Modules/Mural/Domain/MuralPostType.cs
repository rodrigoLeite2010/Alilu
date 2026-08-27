namespace Alilu.Modules.Mural.Domain;

/// <summary>
/// Etapa 23 (pedido de Rodrigo: "Mural, onde e texto aberto por morador,
/// reclamacoes, sugestoes, comentar sobre prestador nao cadastrado,
/// avisar sobre problemas") — categoriza o post, mas NUNCA restringe o
/// conteudo (o campo <see cref="MuralPost.Content"/> e sempre texto livre,
/// qualquer que seja o tipo). Os quatro valores replicam exatamente os
/// quatro exemplos citados por Rodrigo no pedido original; se um quinto
/// tipo aparecer no uso real, este enum precisa crescer (nunca reaproveitar
/// um valor existente para outro sentido).
/// </summary>
public enum MuralPostType
{
    /// <summary>Reclamacao.</summary>
    Complaint = 1,

    /// <summary>Sugestao.</summary>
    Suggestion = 2,

    /// <summary>Aviso sobre problema (ex.: elevador quebrado, obra, barulho).</summary>
    Warning = 3,

    /// <summary>Comentario sobre um prestador NAO cadastrado no ALILU (o pedido citou explicitamente esse caso, diferente de uma Recommendation, que so faz sentido para prestador ja identificado por nome).</summary>
    UnregisteredProfessional = 4,
}
