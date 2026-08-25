import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../modules/auth';
import { queryClient } from '../services/queryClient';
import { ThemeProvider, useTheme } from '../theme';

/**
 * Navegador raiz. Fica dentro de <AuthProvider> para poder segurar a
 * navegação (`isBootstrapping`) enquanto a sessão salva é restaurada — sem
 * isso, o app piscaria a tela de login antes de descobrir que já existe um
 * refresh token válido guardado.
 */
function RootNavigator() {
  const { isBootstrapping } = useAuth();
  const { colors } = useTheme();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(resident)" />
      <Stack.Screen name="(professional)" />
      <Stack.Screen name="(administration)" />
    </Stack>
  );
}

/**
 * Layout raiz do ALILU.
 *
 * Registra os providers globais (tema, TanStack Query, safe area,
 * autenticação) e declara os grupos de navegação de nível superior.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
