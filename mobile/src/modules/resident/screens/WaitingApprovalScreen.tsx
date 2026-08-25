import { View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useAuth } from '../../auth';
import { useTheme } from '../../../theme';
import { useMyMemberships } from '../hooks';

/**
 * Mostrada quando o usuário tem uma solicitação Pending (FLUXO 2, PROMPT
 * 05) — ainda não pode entrar na área do morador, mas também não está
 * mais no início do fluxo de validação. "Atualizar" só refaz a consulta
 * de vínculos; se um administrador já aprovou/rejeitou, o gate em
 * `(resident)/index.tsx` troca de tela sozinho.
 */
export function WaitingApprovalScreen() {
  const { spacing } = useTheme();
  const { logout } = useAuth();
  const { refetch, isFetching } = useMyMemberships();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          Solicitação em análise
        </AppText>
        <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
          Um administrador do condomínio vai revisar seu pedido de acesso. Você recebe acesso à área do morador assim
          que ele for aprovado.
        </AppText>

        <View style={{ marginTop: spacing.lg, width: '100%', gap: spacing.sm }}>
          <AppButton label={isFetching ? 'Verificando…' : 'Verificar novamente'} onPress={() => refetch()} disabled={isFetching} />
          <AppButton label="Sair" variant="ghost" onPress={() => logout()} />
        </View>
      </View>
    </Screen>
  );
}
