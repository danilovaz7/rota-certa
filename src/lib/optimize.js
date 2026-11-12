import { geocode } from './geocode.js';
import { getMatrices, estimatedMatrices, getRoute } from './routing.js';
import { solveOpenTsp, pathCost } from './tsp.js';

/**
 * Calcula a rota mais curta (em distância pelas ruas) passando por todas as paradas.
 *
 * @param {{lat:number, lon:number, title:string}} start ponto de partida já localizado
 * @param {{id:string, text:string, place:object|null}[]} stops paradas como estão na tela
 * @param {(message:string) => void} onProgress
 */
export async function planRoute(start, stops, onProgress = () => {}) {
  // 1. Garante coordenadas para todas as paradas
  const located = [];
  const notFound = [];
  const pending = stops.filter((s) => !s.place);
  let done = 0;
  for (const stop of stops) {
    if (stop.place) {
      located.push({ ...stop.place, id: stop.id, typed: stop.text });
      continue;
    }
    done += 1;
    onProgress(`Localizando endereços (${done} de ${pending.length})`);
    const place = await geocode(stop.text, { near: start });
    if (place) located.push({ ...place, id: stop.id, typed: stop.text });
    else notFound.push(stop);
  }
  if (!located.length) {
    throw new Error('Nenhum endereço foi encontrado. Escolha uma das sugestões que aparecem ao digitar.');
  }

  // 2. Distâncias reais entre todos os pares de pontos
  onProgress('Medindo as distâncias pelas ruas');
  const points = [start, ...located];
  let matrices;
  let estimated = false;
  try {
    matrices = await getMatrices(points);
  } catch {
    matrices = estimatedMatrices(points);
    estimated = true;
  }

  // 3. Melhor ordem: menor distância total
  onProgress('Escolhendo a melhor ordem');
  const order = solveOpenTsp(matrices.distance);
  const ordered = order.slice(1).map((i) => points[i]);

  // 4. Traçado pelas ruas para o mapa
  onProgress('Traçando a rota');
  let route = null;
  if (!estimated) {
    try {
      route = await getRoute([start, ...ordered]);
    } catch {
      route = null;
    }
  }

  const legs = route
    ? route.legs
    : order.slice(1).map((to, k) => ({
        distance: matrices.distance[order[k]][to],
        duration: matrices.duration[order[k]][to],
      }));

  return {
    start,
    stops: ordered,
    legs,
    distance: route ? route.distance : pathCost(order, matrices.distance),
    duration: route ? route.duration : pathCost(order, matrices.duration),
    typedOrderDistance: pathCost(points.map((_, i) => i), matrices.distance),
    geometry: route ? route.geometry : null,
    notFound,
    estimated,
  };
}

export const formatKm = (meters) =>
  `${(meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
