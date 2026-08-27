import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { AppText, Avatar } from '../../../components';
import { useTheme } from '../../../theme';
import { authApi } from '../api';
import { useAuth } from '../AuthProvider';

interface EditableAvatarProps {
  /** Nome usado para as iniciais do fallback (mesmo `name` de `Avatar`) — normalmente `user.name`, ou `displayName` no caso do profissional (ver `ProfessionalEditScreen`). */
  name: string;
  size?: number;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
  base64: true,
};

/**
 * React Native: EditableAvatar (Etapa 21) — a foto pessoal de quem está
 * logado, ao lado do próprio nome, em qualquer papel (morador/profissional/
 * administrador). Fica no módulo `auth` (não em `components/`, que é
 * puramente de tema e não conhece nenhum módulo) porque depende de
 * `useAuth()`/`authApi` diretamente — mesmo critério já usado por
 * `reviews/components/RatingSummary.tsx`/`notifications/components/NotificationItem.tsx`.
 *
 * Diferente de `Avatar` (só exibição — usado no diretório público de
 * profissionais para mostrar a foto de OUTRA pessoa), este componente sabe
 * COMO trocar a própria foto: toque no lápis abre "tirar foto"/"escolher da
 * galeria"; o recorte em si é a própria UI nativa do sistema
 * (`expo-image-picker` com `allowsEditing: true, aspect: [1, 1]`) — nenhuma
 * biblioteca de crop customizada foi adicionada. Um "x" separado (só
 * quando já há foto) remove — mantido fora do menu do lápis de propósito:
 * `Alert.alert` só garante 3 botões de forma confiável no Android, e
 * "tirar foto"/"galeria"/"cancelar" já usa os três.
 *
 * Sempre lê `user.photoUrl` de `useAuth()` (nunca recebe como prop) — após
 * o upload, `updateUserPhoto` atualiza o contexto e este componente
 * reflete a nova foto sozinho, sem nenhum callback de quem o usa.
 *
 * Profissionais: o backend espelha automaticamente esta mesma foto em
 * `Professional.photoUrl` (o campo do diretório público) — decisão
 * confirmada com Rodrigo, ver `AuthController.MirrorPhotoToProfessionalProfileAsync`
 * no backend. Este componente não precisa saber disso.
 */
export function EditableAvatar({ name, size = 72 }: EditableAvatarProps) {
  const { colors, shadows } = useTheme();
  const { user, updateUserPhoto } = useAuth();
  const queryClient = useQueryClient();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPhoto = Boolean(user?.photoUrl);
  const badgeSize = Math.round(size * 0.32);

  async function pickFrom(source: 'camera' | 'library') {
    setError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Autorize o acesso à câmera nas configurações do celular para tirar uma foto.'
          : 'Autorize o acesso às fotos nas configurações do celular para escolher uma imagem.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

    if (result.canceled || !result.assets[0]?.base64) {
      return;
    }

    await upload(result.assets[0].base64);
  }

  async function upload(base64Image: string) {
    setIsBusy(true);
    setError(null);
    try {
      // O campo `base64` do expo-image-picker é sempre dados JPEG,
      // independente do formato da imagem original (documentado no próprio
      // pacote) — por isso o contentType aqui é sempre fixo.
      const updated = await authApi.setPhoto(base64Image, 'image/jpeg');
      updateUserPhoto(updated.photoUrl);
      await invalidateProfessionalDirectoryIfNeeded();
    } catch {
      setError('Não foi possível salvar a foto. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  }

  async function remove() {
    setIsBusy(true);
    setError(null);
    try {
      const updated = await authApi.removePhoto();
      updateUserPhoto(updated.photoUrl);
      await invalidateProfessionalDirectoryIfNeeded();
    } catch {
      setError('Não foi possível remover a foto. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * O módulo `auth` não pode importar `professional` (independência de
   * módulos) para invalidar as chaves de query certas por nome — em vez
   * disso, invalida TODAS as queries em cache quando quem trocou a foto é
   * profissional (o backend espelha a mesma foto em `Professional.photoUrl`
   * — ver comentário da classe). Só profissionais pagam esse custo (um
   * refetch geral, não perceptível para quem está só olhando a própria
   * tela): moradores/administradores não alimentam nenhum diretório
   * público, então não precisam disso.
   */
  async function invalidateProfessionalDirectoryIfNeeded() {
    if (user?.role === 'Professional') {
      await queryClient.invalidateQueries();
    }
  }

  function onPressChange() {
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Tirar foto', onPress: () => pickFrom('camera') },
      { text: 'Escolher da galeria', onPress: () => pickFrom('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function onPressRemove() {
    Alert.alert('Remover foto', 'Tem certeza que deseja remover sua foto de perfil?', [
      { text: 'Remover', style: 'destructive', onPress: () => remove() },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <View style={{ gap: 4 }}>
      <View style={{ width: size, height: size }}>
        <Avatar photoUrl={user?.photoUrl} name={name} size={size} />

        <Pressable
          onPress={onPressChange}
          disabled={isBusy}
          hitSlop={6}
          style={[
            shadows.sm,
            {
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: colors.brand.accent,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.background,
              opacity: isBusy ? 0.6 : 1,
            },
          ]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <AppText style={{ color: colors.text.inverse, fontSize: badgeSize * 0.55, fontWeight: '700' }}>✎</AppText>
          )}
        </Pressable>

        {hasPhoto ? (
          <Pressable
            onPress={onPressRemove}
            disabled={isBusy}
            hitSlop={6}
            style={[
              shadows.sm,
              {
                position: 'absolute',
                left: -2,
                top: -2,
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.background,
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
          >
            <AppText style={{ color: colors.semantic.error, fontSize: badgeSize * 0.6, fontWeight: '700' }}>✕</AppText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="caption" style={{ color: colors.semantic.error, maxWidth: size * 3 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
