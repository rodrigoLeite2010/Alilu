import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Ponto de entrada do app ALILU.
 *
 * Nesta etapa (fundação) nenhuma tela de negócio foi implementada ainda —
 * apenas o esqueleto do projeto Expo + TypeScript, conforme decidido no
 * PROMPT 00. As telas (login, busca de diarista, agendamento, etc.) serão
 * construídas junto com os módulos correspondentes do backend.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ALILU</Text>
      <Text style={styles.subtitle}>Fundação do projeto — em construção</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});
