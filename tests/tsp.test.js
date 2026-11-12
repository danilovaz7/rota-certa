import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveOpenTsp, exactSearch, nearestNeighbor, localSearch, iteratedLocalSearch, pathCost } from '../src/lib/tsp.js';
import { haversine, estimatedMatrices } from '../src/lib/routing.js';
import { googleMapsLinks, wazeLink } from '../src/lib/links.js';

// Gerador pseudoaleatório com semente, para os testes serem reproduzíveis.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function randomPoints(n, rand) {
  return Array.from({ length: n }, () => ({ lat: -23.6 + rand() * 0.2, lon: -46.7 + rand() * 0.2 }));
}

function asymmetric(matrix, rand) {
  return matrix.map((row, i) => row.map((v, j) => (i === j ? 0 : v * (0.8 + rand() * 0.6))));
}

const isPermutationFromZero = (route, n) =>
  route[0] === 0 && route.length === n && new Set(route).size === n;

test('casos pequenos', () => {
  assert.deepEqual(solveOpenTsp([[0]]), [0]);
  assert.deepEqual(solveOpenTsp([[0, 5], [5, 0]]), [0, 1]);
});

test('pontos em linha: visita em sequência a partir da ponta', () => {
  // Partida em 0, paradas em 3, 1, 4, 2 (posições numa reta), embaralhadas
  const pos = [0, 3, 1, 4, 2];
  const m = pos.map((a) => pos.map((b) => Math.abs(a - b)));
  const route = solveOpenTsp(m);
  assert.deepEqual(route.map((i) => pos[i]), [0, 1, 2, 3, 4]);
});

test('busca exata encontra o ótimo (comparação com todas as permutações)', () => {
  const rand = rng(42);
  const pts = randomPoints(7, rand);
  const m = asymmetric(estimatedMatrices(pts).distance, rand);
  const permute = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) =>
    permute([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
  const brute = Math.min(...permute([1, 2, 3, 4, 5, 6]).map((p) => pathCost([0, ...p], m)));
  assert.ok(Math.abs(pathCost(exactSearch(m), m) - brute) < 1e-6);
});

test('heurística fica perto do ótimo (10 paradas, 30 cenários)', () => {
  const rand = rng(7);
  let worstGap = 0;
  let totalGap = 0;
  const runs = 30;
  for (let r = 0; r < runs; r++) {
    const pts = randomPoints(11, rand);
    const m = r % 2 ? asymmetric(estimatedMatrices(pts).distance, rand) : estimatedMatrices(pts).distance;
    const optimal = pathCost(exactSearch(m), m);
    const heuristic = iteratedLocalSearch(m);
    assert.ok(isPermutationFromZero(heuristic, 11));
    const gap = pathCost(heuristic, m) / optimal - 1;
    worstGap = Math.max(worstGap, gap);
    totalGap += gap;
  }
  console.log(`  diferença média para o ótimo: ${(100 * totalGap / runs).toFixed(2)}% | pior caso: ${(100 * worstGap).toFixed(2)}%`);
  assert.ok(worstGap < 0.02, `pior caso ${(worstGap * 100).toFixed(1)}%`);
});

test('60 paradas: rota válida e rápida', () => {
  const rand = rng(99);
  const pts = randomPoints(61, rand);
  const m = estimatedMatrices(pts).distance;
  const t0 = performance.now();
  const route = solveOpenTsp(m);
  const ms = performance.now() - t0;
  console.log(`  60 paradas resolvidas em ${ms.toFixed(0)} ms`);
  assert.ok(isPermutationFromZero(route, 61));
  assert.ok(pathCost(route, m) <= pathCost(nearestNeighbor(m), m));
  assert.ok(ms < 3000);
});

test('haversine: São Paulo → Rio ≈ 360 km', () => {
  const d = haversine({ lat: -23.5505, lon: -46.6333 }, { lat: -22.9068, lon: -43.1729 });
  assert.ok(d > 350000 && d < 370000);
});

test('links do Google Maps dividem rotas longas', () => {
  const start = { lat: -23.5, lon: -46.6 };
  const stops = Array.from({ length: 23 }, (_, i) => ({ lat: -23.5 + i / 100, lon: -46.6 }));
  const links = googleMapsLinks(start, stops);
  assert.deepEqual(links.map((l) => [l.from, l.to]), [[1, 10], [11, 20], [21, 23]]);
  const first = new URL(links[0].url);
  assert.equal(first.searchParams.get('origin'), '-23.500000,-46.600000');
  assert.equal(first.searchParams.get('waypoints').split('|').length, 9);
  // a parte 2 começa onde a parte 1 terminou
  assert.equal(new URL(links[1].url).searchParams.get('origin'), first.searchParams.get('destination'));
  assert.equal(wazeLink(stops[0]), 'https://waze.com/ul?ll=-23.500000,-46.600000&navigate=yes');
});
