/**
 * Cor de fundo, cor do texto e combinações prontas do editor (ETAPA 5.3).
 */

export interface PostColorCombo {
  id: string;
  label: string;
  background: string;
  heading: string;
  body: string;
  footer: string;
  accent: string;
  badgeBackground: string;
  badgeText: string;
}

export const POST_COLOR_COMBOS: PostColorCombo[] = [
  {
    id: "teal",
    label: "Teal & branco",
    background: "#0f766e",
    heading: "#ffffff",
    body: "#e6fffa",
    footer: "#ccfbf1",
    accent: "#facc15",
    badgeBackground: "#facc15",
    badgeText: "#111827",
  },
  {
    id: "sunset",
    label: "Pôr do sol",
    background: "#c2410c",
    heading: "#fff7ed",
    body: "#ffedd5",
    footer: "#fed7aa",
    accent: "#fde68a",
    badgeBackground: "#111827",
    badgeText: "#fde68a",
  },
  {
    id: "midnight",
    label: "Meia-noite",
    background: "#111827",
    heading: "#ffffff",
    body: "#d1d5db",
    footer: "#9ca3af",
    accent: "#38bdf8",
    badgeBackground: "#38bdf8",
    badgeText: "#0b1220",
  },
  {
    id: "berry",
    label: "Berry",
    background: "#7e22ce",
    heading: "#fdf4ff",
    body: "#f3e8ff",
    footer: "#e9d5ff",
    accent: "#facc15",
    badgeBackground: "#facc15",
    badgeText: "#3b0764",
  },
  {
    id: "paper",
    label: "Papel claro",
    background: "#fafaf9",
    heading: "#1c1917",
    body: "#44403c",
    footer: "#78716c",
    accent: "#0f766e",
    badgeBackground: "#0f766e",
    badgeText: "#ffffff",
  },
  {
    id: "forest",
    label: "Floresta",
    background: "#14532d",
    heading: "#f0fdf4",
    body: "#dcfce7",
    footer: "#bbf7d0",
    accent: "#fbbf24",
    badgeBackground: "#fbbf24",
    badgeText: "#14532d",
  },
];

export const DEFAULT_COLOR_COMBO_ID = "teal";

export function getColorComboById(id: string): PostColorCombo {
  return POST_COLOR_COMBOS.find((combo) => combo.id === id) ?? POST_COLOR_COMBOS[0];
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}
