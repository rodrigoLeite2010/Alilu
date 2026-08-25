namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Como um vínculo <see cref="ProfessionalCondominium"/> nasceu (PROMPT 06,
/// valores exatos pedidos no prompt).
///
/// Nesta etapa, o único fluxo com caminho de criação real é
/// <see cref="ProfessionalRequested"/> (o próprio profissional solicita
/// atendimento a um condomínio — "Ainda NÃO criar agenda", então não há,
/// por enquanto, nada além disso disparando a criação automática do
/// vínculo) e <see cref="AdminApproved"/> (um administrador vincula um
/// profissional diretamente, ex.: cadastro manual de um prestador já
/// conhecido do condomínio). <see cref="ResidentRecommended"/> (módulo
/// Recommendations) e <see cref="CompletedService"/> (módulos
/// Scheduling/Reviews) são reservados para quando esses módulos existirem —
/// o valor já está aqui porque o prompt pediu os quatro, mas nenhum
/// caso de uso desta etapa os produz.
/// </summary>
public enum ProfessionalCondominiumSource
{
    AdminApproved = 1,
    ResidentRecommended = 2,
    CompletedService = 3,
    ProfessionalRequested = 4,
}
