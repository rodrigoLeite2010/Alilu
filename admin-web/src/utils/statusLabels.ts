/**
 * Etapa 23 (pedido de Rodrigo: "colar os textos internos em português —
 * está em inglês") — tradução dos valores brutos de enum que a Api devolve
 * (status/papel), pra nunca mais aparecer "Pending"/"Resident" etc. cru na
 * tela. Central pra não duplicar o mapa em cada página que usa
 * `StatusBadge` (Condomínios/Moradores/Profissionais/Recomendações/Unidades)
 * nem no cabeçalho (`Layout`, que mostra o papel do usuário logado).
 *
 * Cobre os valores que aparecem hoje: `MembershipStatus`, `ProfessionalCondominiumStatus`,
 * `RecommendationStatus`, `BookingStatus`, `MuralPostStatus` (Etapa 23) e
 * `UserRole` (back-end, módulos Resident/Professional/Recommendations/
 * Scheduling/Mural/Identity). Um valor não
 * mapeado cai no próprio texto em inglês (nunca quebra a tela) — se a Api
 * ganhar um status novo, ele só aparece sem tradução até este mapa ser
 * atualizado.
 */
const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pendente',
  Active: 'Ativo',
  Approved: 'Aprovado',
  Rejected: 'Recusado',
  Blocked: 'Bloqueado',
  Visible: 'Visível',
  Inactive: 'Inativo',
  Requested: 'Solicitado',
  Confirmed: 'Confirmado',
  InProgress: 'Em andamento',
  Completed: 'Concluído',
  NoShow: 'Não compareceu',
  CancelledByResident: 'Cancelado pelo morador',
  CancelledByProfessional: 'Cancelado pelo profissional',
};

/** React Native já traduz status em pelo menos duas telas (MyAgendaScreen/ProfessionalEditScreen) — este mapa é o equivalente pro admin-web, que ainda não tinha nenhum. */
export function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const ROLE_LABELS: Record<string, string> = {
  Resident: 'Morador',
  Professional: 'Profissional',
  CondominiumAdmin: 'Síndico',
  SuperAdmin: 'Super administrador',
};

/** Usado no cabeçalho (`Layout`) — hoje mostrava `user.role` cru em inglês. */
export function translateRole(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
