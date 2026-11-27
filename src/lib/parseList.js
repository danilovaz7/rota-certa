// Transforma um texto colado (uma lista do WhatsApp, de uma planilha, de um e-mail)
// em endereços, um por linha.

// "1.", "1)", "1 -", "- ", "• ", "* ", "☐ " no começo da linha
const BULLET = /^\s*(?:\d{1,3}\s*[.)\-–:]\s+|[-–•*·▪►✅☐☑]\s*)/u;

/**
 * @param {string} text
 * @returns {string[]} endereços sem numeração, sem linhas vazias e sem repetidos
 */
export function parseAddressList(text) {
  const seen = new Set();
  const result = [];
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw
      .replace(BULLET, '')
      .replace(/\t+/g, ', ') // colunas de planilha viram partes do endereço
      .replace(/\s+/g, ' ')
      .replace(/^[\s,]+|[\s,]+$/g, '');
    if (line.length < 3) continue;
    const key = normalize(line);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

/** Compara endereços ignorando maiúsculas, acentos e espaços. */
export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Palavras que encerram o ditado em vez de virar endereço
const STOP_WORDS = new Set(['pronto', 'parar', 'para', 'terminei', 'acabou', 'fim', 'chega', 'ok pronto']);

/** A frase falada é um comando para parar de ouvir? */
export function isStopCommand(text) {
  return STOP_WORDS.has(normalize(text));
}

/**
 * Ajusta o que o reconhecimento de voz devolve para virar um endereço:
 * "rua azevedo sodré número 120 vírgula santos" → "Rua azevedo sodré 120, santos"
 */
export function cleanSpoken(text) {
  const cleaned = text
    .replace(/\s*\b(v[ií]rgula)\b\s*/gi, ', ')
    .replace(/\b(n[uú]mero|n[º°o]\.?)\s+(?=\d)/gi, '')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.]+|[\s,.]+$/g, '');
  // Iniciais maiúsculas, menos nas palavras de ligação: "Rua Barão de Paranapiacaba"
  return cleaned
    .split(' ')
    .map((word, i) => (i > 0 && LOWER.has(word.toLowerCase()) ? word.toLowerCase() : capitalize(word)))
    .join(' ');
}

const LOWER = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o']);
const capitalize = (word) => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
