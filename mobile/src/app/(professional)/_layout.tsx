import { Stack } from 'expo-router';

/**
 * ProfessionalStack — telas voltadas ao profissional. Desde o PROMPT 06, o
 * próprio `index` decide (com base em `useMyProfessionalProfile`) se
 * mostra o formulário de criação de perfil ou o próprio perfil (edição +
 * serviços + condomínios) — mesmo padrão de `(resident)/index.tsx`
 * (PROMPT 05). Agenda/disponibilidade/atendimentos ainda não foram
 * implementados ("Ainda NÃO criar agenda" — PROMPT 06).
 */
export default function ProfessionalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
