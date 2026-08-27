/**
 * Sombras/elevação (Etapa 20 — modernização visual "estilo iFood/apps
 * atuais"). Antes desta etapa nenhuma tela usava `shadow*`/`elevation` — o
 * app inteiro era "flat". Cores da marca continuam intocadas (pedido
 * explícito de Rodrigo: "manter as cores da marca, modernizar só a
 * forma") — sombra é preto com opacidade baixa, não uma cor da paleta.
 *
 * Import direto dos arquivos de token (não de `./index`) pelo mesmo motivo
 * documentado em `theme.ts`/`ThemeProvider.tsx`: evitar o ciclo de módulos
 * que quebra no Expo Web.
 *
 * `elevation` (Android) não aceita as mesmas nuances de `shadowRadius`/
 * `shadowOpacity` (iOS/Web) — os três níveis abaixo foram calibrados para
 * ficarem visualmente equivalentes nas duas plataformas.
 */
type ShadowStyle = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

function shadow(offsetY: number, opacity: number, radius: number, elevation: number): ShadowStyle {
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export const shadows = {
  /** Nenhuma sombra — uso explícito quando um componente precisa "desligar" a sombra herdada (ex.: variante `ghost`). */
  none: shadow(0, 0, 0, 0),
  /** Elevação sutil — cards de lista, inputs em foco, itens de linha. */
  sm: shadow(1, 0.06, 3, 2),
  /** Elevação média — cards de destaque, botão primário, avatar. */
  md: shadow(4, 0.1, 10, 4),
  /** Elevação alta — modais, elementos flutuantes (uso raro; app não tem modal hoje). */
  lg: shadow(8, 0.14, 20, 8),
} as const;

export type Shadows = typeof shadows;
