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
