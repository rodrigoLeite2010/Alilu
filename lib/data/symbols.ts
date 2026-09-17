/**
 * Catálogo estático de símbolos para copiar (categoria Geradores). Mantido
 * isolado da interface (PROMPT MESTRE, seção 14). Diferente dos
 * geradores, este arquivo não sorteia nada: é apenas uma lista curada,
 * pesquisável por nome, de caracteres Unicode comuns para copiar e colar.
 */

export interface SymbolEntry {
  char: string;
  name: string;
  category: string;
}

export const SYMBOL_CATEGORIES = [
  "Setas",
  "Moeda",
  "Matemática",
  "Pontuação e tipografia",
  "Formas",
  "Diversos",
] as const;

export type SymbolCategory = (typeof SYMBOL_CATEGORIES)[number];

export const SYMBOLS: SymbolEntry[] = [
  // Setas
  { char: "→", name: "seta para a direita", category: "Setas" },
  { char: "←", name: "seta para a esquerda", category: "Setas" },
  { char: "↑", name: "seta para cima", category: "Setas" },
  { char: "↓", name: "seta para baixo", category: "Setas" },
  { char: "↔", name: "seta dupla horizontal", category: "Setas" },
  { char: "↕", name: "seta dupla vertical", category: "Setas" },
  { char: "⇒", name: "seta dupla para a direita", category: "Setas" },
  { char: "⇐", name: "seta dupla para a esquerda", category: "Setas" },
  { char: "⇑", name: "seta dupla para cima", category: "Setas" },
  { char: "⇓", name: "seta dupla para baixo", category: "Setas" },
  { char: "➜", name: "seta estilizada", category: "Setas" },
  { char: "➤", name: "seta sólida", category: "Setas" },

  // Moeda
  { char: "R$", name: "real (moeda brasileira)", category: "Moeda" },
  { char: "$", name: "dólar", category: "Moeda" },
  { char: "€", name: "euro", category: "Moeda" },
  { char: "£", name: "libra esterlina", category: "Moeda" },
  { char: "¥", name: "iene / iuan", category: "Moeda" },
  { char: "¢", name: "centavo", category: "Moeda" },
  { char: "₿", name: "bitcoin", category: "Moeda" },
  { char: "₹", name: "rupia indiana", category: "Moeda" },

  // Matemática
  { char: "±", name: "mais ou menos", category: "Matemática" },
  { char: "×", name: "multiplicação", category: "Matemática" },
  { char: "÷", name: "divisão", category: "Matemática" },
  { char: "√", name: "raiz quadrada", category: "Matemática" },
  { char: "∞", name: "infinito", category: "Matemática" },
  { char: "≈", name: "aproximadamente igual", category: "Matemática" },
  { char: "≠", name: "diferente", category: "Matemática" },
  { char: "≤", name: "menor ou igual", category: "Matemática" },
  { char: "≥", name: "maior ou igual", category: "Matemática" },
  { char: "∑", name: "somatório", category: "Matemática" },
  { char: "π", name: "pi", category: "Matemática" },
  { char: "∆", name: "delta", category: "Matemática" },
  { char: "°", name: "grau", category: "Matemática" },
  { char: "‰", name: "por mil", category: "Matemática" },
  { char: "%", name: "porcentagem", category: "Matemática" },

  // Pontuação e tipografia
  { char: "§", name: "parágrafo (seção)", category: "Pontuação e tipografia" },
  { char: "¶", name: "pilcrow (marca de parágrafo)", category: "Pontuação e tipografia" },
  { char: "†", name: "obelisco (nota de rodapé)", category: "Pontuação e tipografia" },
  { char: "‡", name: "obelisco duplo", category: "Pontuação e tipografia" },
  { char: "•", name: "marcador (bullet)", category: "Pontuação e tipografia" },
  { char: "…", name: "reticências", category: "Pontuação e tipografia" },
  { char: "«", name: "aspas angulares de abertura", category: "Pontuação e tipografia" },
  { char: "»", name: "aspas angulares de fechamento", category: "Pontuação e tipografia" },
  { char: "¡", name: "exclamação invertida", category: "Pontuação e tipografia" },
  { char: "¿", name: "interrogação invertida", category: "Pontuação e tipografia" },
  { char: "@", name: "arroba", category: "Pontuação e tipografia" },
  { char: "&", name: "e comercial (ampersand)", category: "Pontuação e tipografia" },

  // Formas
  { char: "★", name: "estrela preenchida", category: "Formas" },
  { char: "☆", name: "estrela vazada", category: "Formas" },
  { char: "●", name: "círculo preenchido", category: "Formas" },
  { char: "○", name: "círculo vazado", category: "Formas" },
  { char: "■", name: "quadrado preenchido", category: "Formas" },
  { char: "□", name: "quadrado vazado", category: "Formas" },
  { char: "▲", name: "triângulo preenchido", category: "Formas" },
  { char: "△", name: "triângulo vazado", category: "Formas" },
  { char: "♦", name: "losango (naipe de ouros)", category: "Formas" },
  { char: "♥", name: "coração (naipe de copas)", category: "Formas" },
  { char: "♣", name: "naipe de paus", category: "Formas" },
  { char: "♠", name: "naipe de espadas", category: "Formas" },
  { char: "✓", name: "marca de certo", category: "Formas" },
  { char: "✔", name: "marca de certo (negrito)", category: "Formas" },
  { char: "✗", name: "marca de errado", category: "Formas" },

  // Diversos
  { char: "©", name: "copyright", category: "Diversos" },
  { char: "®", name: "marca registrada", category: "Diversos" },
  { char: "™", name: "trademark", category: "Diversos" },
  { char: "☺", name: "carinha feliz", category: "Diversos" },
  { char: "☻", name: "carinha feliz preenchida", category: "Diversos" },
  { char: "♪", name: "nota musical", category: "Diversos" },
  { char: "♫", name: "notas musicais", category: "Diversos" },
  { char: "⚡", name: "raio", category: "Diversos" },
  { char: "☀", name: "sol", category: "Diversos" },
  { char: "☁", name: "nuvem", category: "Diversos" },
  { char: "☂", name: "guarda-chuva", category: "Diversos" },
  { char: "✈", name: "avião", category: "Diversos" },
  { char: "⌘", name: "tecla comando", category: "Diversos" },
  { char: "⚙", name: "engrenagem", category: "Diversos" },
];

export function getSymbolsByCategory(category: SymbolCategory): SymbolEntry[] {
  return SYMBOLS.filter((symbol) => symbol.category === category);
}

/** Busca símbolos pelo nome (em português) ou pelo próprio caractere. */
export function searchSymbols(query: string): SymbolEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return SYMBOLS;

  return SYMBOLS.filter(
    (symbol) => symbol.name.toLowerCase().includes(normalized) || symbol.char === query.trim()
  );
}
