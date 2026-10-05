/**
 * Estimativa de sílabas em português (heurística — NÃO é separação silábica
 * gramatical). Conta grupos de vogais e corrige os casos mais comuns:
 *
 * - "qu"/"gu" antes de e/i: o "u" não soa ("que", "guerra"), exceto com trema;
 * - ditongos e nasais ("ai", "ei", "ou", "ão", "ões", "ãe") = 1 sílaba;
 * - hiato entre duas vogais fortes (a/e/o): "po-e-ta", "le-ão" não (nasal);
 * - "í"/"ú" acentuados depois de vogal são hiato: "sa-í-da", "sa-ú-de";
 * - palavra sem vogal (sigla, "pq") conta 1.
 *
 * Erra em alguns casos ("fluido", "rio" vs "ri-o"), o que é aceitável para
 * médias de legibilidade.
 */

const VOWELS = new Set([..."aeiouáéíóúâêôãõàüy"]);
const STRONG = new Set([..."aeoáéóâêôãõà"]);
const NASAL_FIRST = new Set([..."ãõ"]);
const ACCENTED_WEAK = new Set([..."íú"]);

function isVowel(char: string): boolean {
  return VOWELS.has(char);
}

/** Remove o "u" mudo de "qu"/"gu" antes de e/i (mantém "ü"). */
function dropSilentU(word: string): string {
  return word.replace(/([qg])u(?=[eéêiíî])/g, "$1");
}

/** Sílabas extras dentro de um grupo de vogais seguidas (hiatos). */
function hiatusesInGroup(group: string): number {
  let extra = 0;
  for (let index = 1; index < group.length; index += 1) {
    const previous = group[index - 1];
    const current = group[index];
    if (ACCENTED_WEAK.has(current)) {
      extra += 1; // sa-ú-de, sa-í-da
    } else if (STRONG.has(previous) && STRONG.has(current) && !NASAL_FIRST.has(previous)) {
      extra += 1; // po-e-ta, ca-o-lho
    }
  }
  return extra;
}

export function countSyllablesPortuguese(rawWord: string): number {
  const word = dropSilentU(rawWord.toLowerCase().replace(/[^a-zà-öø-ÿ]/g, ""));
  if (!word) return 0;
  let syllables = 0;
  let group = "";
  for (const char of word) {
    if (isVowel(char)) {
      group += char;
      continue;
    }
    if (group) {
      syllables += 1 + hiatusesInGroup(group);
      group = "";
    }
  }
  if (group) syllables += 1 + hiatusesInGroup(group);
  return Math.max(1, syllables);
}
