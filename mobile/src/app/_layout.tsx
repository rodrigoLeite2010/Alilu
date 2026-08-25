import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../services/queryClient';
import { ThemeProvider, colors } from '../theme';

/**
 * Layout raiz do ALILU.
 *
 * Registra os providers globais (tema, TanStack Query, safe area) e
 * declara os grupos de navegação de nível superior. Nesta etapa não há
 * autenticação implementada, então nenhuma lógica de redirecionamento
 * entre stacks existe ainda — cada grupo é apenas uma rota alcançável.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
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
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
