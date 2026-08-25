namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Estado do vínculo profissional↔condomínio (<see cref="ProfessionalCondominium"/>) —
/// "o profissional atende aquele condomínio" (PROMPT 06).
///
/// Pending: solicitação do profissional aguardando aprovação administrativa
/// (nasce assim quando <see cref="ProfessionalCondominiumSource.ProfessionalRequested"/>).
/// Active: o profissional está autorizado a atender o condomínio.
/// Rejected: solicitação recusada por um administrador.
/// Inactive: vínculo que já foi Active e foi desativado (ex.: profissional
/// parou de atender aquele condomínio).
/// </summary>
public enum ProfessionalCondominiumStatus
{
    Pending = 1,
    Active = 2,
    Rejected = 3,
    Inactive = 4,
}
