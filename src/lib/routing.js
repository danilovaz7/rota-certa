// Distâncias e traçado pelas ruas usando o OSRM (Open Source Routing Machine), gratuito.
// O servidor público de demonstração serve para testes e uso leve. Para uso pesado,
// dá para hospedar um OSRM próprio e trocar a constante abaixo.

const OSRM = 'https://router.project-osrm.org';
const TIMEOUT_MS = 20000;

// Usados apenas quando o OSRM não responde: estimativa a partir da linha reta.
const ROAD_FACTOR = 1.3;        // ruas costumam ser ~30% mais longas que a linha reta
const FALLBACK_SPEED = 30 / 3.6; // 30 km/h em m/s, média urbana

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.code !== 'Ok') throw new Error(data.message || data.code);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const toCoords = (points) => points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

/** Distância em linha reta (metros) entre dois pontos {lat, lon}. */
export function haversine(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Matrizes estimadas sem internet de rotas (linha reta × fator de rua). */
export function estimatedMatrices(points) {
  const distance = points.map((a) => points.map((b) => haversine(a, b) * ROAD_FACTOR));
  const duration = distance.map((row) => row.map((d) => d / FALLBACK_SPEED));
  return { distance, duration };
}

/**
 * Matrizes de distância (m) e tempo (s) de carro entre todos os pares de pontos.
 * @returns {Promise<{distance:number[][], duration:number[][]}>}
 */
export async function getMatrices(points) {
  const url = `${OSRM}/table/v1/driving/${toCoords(points)}?annotations=distance,duration`;
  const data = await fetchJson(url);
  const estimate = estimatedMatrices(points);
  // Pares sem rota possível vêm como null: penaliza para o algoritmo evitá-los.
  const fill = (matrix, fallback) =>
    matrix.map((row, i) => row.map((v, j) => (v == null ? fallback[i][j] * 3 : v)));
  return {
    distance: fill(data.distances, estimate.distance),
    duration: fill(data.durations, estimate.duration),
  };
}

/**
 * Traçado da rota passando pelos pontos na ordem dada.
 * @returns {Promise<{geometry: {type:string, coordinates:number[][]}, distance:number, duration:number, legs:{distance:number, duration:number}[]}>}
 */
export async function getRoute(orderedPoints) {
  const url = `${OSRM}/route/v1/driving/${toCoords(orderedPoints)}?overview=full&geometries=geojson`;
  const data = await fetchJson(url);
  const route = data.routes[0];
  return {
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((leg) => ({ distance: leg.distance, duration: leg.duration })),
  };
}
