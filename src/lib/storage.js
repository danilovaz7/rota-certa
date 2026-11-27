// Guarda o estado do app no aparelho. No celular, ao abrir o Waze ou o Google Maps,
// o navegador costuma descarregar a aba; sem isso, a pessoa voltaria e perderia a rota.

const KEY = 'rota-certa:estado:v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3; // rotas com mais de 3 dias são descartadas

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== 'object') return null;
    if (Date.now() - (saved.savedAt || 0) > MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // modo anônimo ou armazenamento cheio: o app continua funcionando sem salvar
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
}
