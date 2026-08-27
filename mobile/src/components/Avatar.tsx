import { Image, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

interface AvatarProps {
  /** URL da foto (`Professional.photoUrl`/`ProfessionalDirectoryItem.photoUrl`). Quando ausente ou a imagem falha ao carregar, mostra as iniciais do nome. */
  photoUrl?: string | null;
  /** Nome usado para calcular as iniciais do fallback (ex.: "Thais Araujo" → "TA"). */
  name: string;
  /** Diâmetro em pixels. @default 56 */
  size?: number;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

/**
 * React Native: Avatar (Etapa 20 — modernização visual). Primeiro uso de
 * `<Image>` neste app: `photoUrl` existe em `Professional`/
 * `ProfessionalDirectoryItem` desde o PROMPT 06, mas nenhuma tela chegou a
 * renderizar a foto visualmente até agora — só texto. Sem foto (ou
 * `photoUrl: null`, o caso mais comum hoje já que não há tela de upload de
 * foto), mostra um círculo com as iniciais do nome sobre o dourado da
 * marca (`colors.brand.accent`), nunca um ícone genérico — mantém a
 * identidade visual (cores da marca) mesmo no fallback.
 */
export function Avatar({ photoUrl, name, size = 56 }: AvatarProps) {
  const { colors } = useTheme();

  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[dimensionStyle, { backgroundColor: colors.surfaceAlt }]}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={[
        dimensionStyle,
        {
          backgroundColor: colors.brand.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      accessibilityLabel={name}
    >
      <AppText style={{ color: colors.text.inverse, fontSize: size * 0.38, fontWeight: '700' }}>
        {initialsFor(name)}
      </AppText>
    </View>
  );
}
