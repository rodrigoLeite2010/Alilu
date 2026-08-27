/**
 * Máscara de telefone brasileiro (React Native: RegisterScreen —
 * "cadastro" de morador/profissional — e ProfessionalEditScreen —
 * "criar/editar perfil profissional"). Sem biblioteca externa (mesma
 * convenção do resto do projeto, ex.: `buildMonthGrid` em
 * `scheduling/schedulingFormat.ts`).
 *
 * Progressivo: enquanto a pessoa digita, decide entre o formato de
 * telefone fixo ("(11) 3456-7890", 10 dígitos) e celular
 * ("(11) 91234-5678", 11 dígitos) só pela quantidade de dígitos já
 * digitados — a mesma técnica usada pelas bibliotecas de máscara mais
 * comuns (ex.: react-native-masked-text) para não travar o usuário
 * escolhendo o formato antes da hora.
 *
 * O backend guarda `Phone` como texto livre, sem validar formato (ver
 * `User.Update`/`Professional.Update`, `Normalize(phone, 20)`) — a
 * máscara aqui é só uma melhoria de UX na digitação, nunca bloqueia o
 * envio.
 */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) {
    return `(${ddd}) ${rest}`;
  }

  // Até 10 dígitos no total: telefone fixo (4+4). A partir do 11º: celular (5+4).
  const splitAt = digits.length <= 10 ? 4 : 5;
  return `(${ddd}) ${rest.slice(0, splitAt)}-${rest.slice(splitAt)}`;
}
